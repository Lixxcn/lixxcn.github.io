# K8s Ingress核心实战指南

Ingress 是 Kubernetes 中用于管理集群外部访问集群内部服务的 API 对象，它提供了基于 HTTP 和 HTTPS 的七层路由能力。本文将详细介绍如何在基于 `kubeadm`搭建的裸金属（Bare-metal）集群中部署和使用 Ingress。

## 核心概念

Ingress 由两大核心组件构成：

1.  **Ingress 资源 (Resource)**：一个 Kubernetes API 对象，用于定义路由规则。它本身不具备流量转发能力，仅是一份规则声明。例如，声明将域名 `webapp.example.com` 的 `/api` 路径流量转发至 `api-service`。
2.  **Ingress 控制器 (Controller)**：一个实际运行在集群中的程序（通常为 Pod），它持续监听 Ingress 资源的变化，并根据这些规则来配置一个真正的代理服务器（如 NGINX、Traefik），从而执行流量的转发。

因此，标准操作流程是：**先部署 Ingress Controller，再创建 Ingress 资源来定义路由规则。**

---

## 第一步：安装 Ingress Controller

本文以社区最活跃的 NGINX Ingress Controller 为例。

#### 1. 应用安装清单

官方提供了针对裸金属环境的部署清单，它会通过 `NodePort` 的方式暴露 Ingress Controller 服务。

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/baremetal/deploy.yaml
```

> **注意**：`v1.10.1` 是编写此笔记时的较新版本。建议在部署前访问 [官方 GitHub Release 页面](https://github.com/kubernetes/ingress-nginx/releases) 以获取最新或特定版本的 `deploy.yaml` 文件。

#### 2. 验证安装

该命令会在 `ingress-nginx` 命名空间中创建所需资源。通过以下命令检查 Controller Pod 是否正常运行：

```bash
kubectl get pods -n ingress-nginx
```

预期会看到名为 `ingress-nginx-controller-xxxxx` 的 Pod 处于 `Running` 状态。

#### 3. 查看暴露端口

检查 Ingress Controller 的 Service 以获取其对外暴露的 `NodePort`。

```bash
kubectl get svc -n ingress-nginx
```

输出结果类似如下：

```
NAME                       TYPE       CLUSTER-IP      EXTERNAL-IP   PORT(S)                      AGE
ingress-nginx-controller   NodePort   10.106.51.189   <none>        80:32080/TCP,443:32443/TCP   5m
```

这表明，集群中**任何一个 Node 节点的 IP** 加上端口 `32080` (HTTP) 或 `32443` (HTTPS) 即可访问到 Ingress Controller。

---

## 第二步：创建并暴露一个简单服务

在配置路由规则前，我们先部署一个示例应用。

#### 1. 准备示例应用与服务

创建一个 `demo-app.yaml` 文件，内容如下：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-webapp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
    spec:
      containers:
      - name: webapp
        image: nginx:1.19-alpine # 使用 Nginx 镜像作为示例
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: my-webapp-svc
spec:
  selector:
    app: webapp
  ports:
    - protocol: TCP
      port: 80 # Service 端口
      targetPort: 80 # Pod 端口
```

部署该应用：

```bash
kubectl apply -f demo-app.yaml
```

#### 2. 创建 Ingress 规则

创建 `my-ingress.yaml` 文件，定义将特定域名和路径的流量转发到上述服务。

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-webapp-ingress
spec:
  # 指定该 Ingress 由哪个 Controller 处理，名称需与 Controller Class 匹配
  ingressClassName: nginx 
  rules:
  - host: "webapp.example.com" # 定义用于访问的域名
    http:
      paths:
      - path: "/" # 匹配根路径
        pathType: Prefix # 路径匹配类型，Prefix 表示前缀匹配
        backend:
          service:
            name: my-webapp-svc # 目标 Service 名称
            port:
              number: 80 # 目标 Service 端口
```

应用该规则：

```bash
kubectl apply -f my-ingress.yaml
```

#### 3. 测试访问

为了使域名 `webapp.example.com` 指向我们的集群，需要在访问端配置 DNS 解析或修改本地 `hosts` 文件。

*   **修改 hosts 文件 (推荐用于测试)**
    在本地机器的 `hosts` 文件（如 Linux/macOS 的 `/etc/hosts`）中添加一条记录：
    ```
    <YOUR_NODE_IP> webapp.example.com
    ```
    将 `<YOUR_NODE_IP>` 替换为集群中任意节点的 IP 地址。

*   **发起访问（带 NodePort）**
    使用 `curl` 命令或浏览器访问，注意 URL 中需包含第一步获取的 `NodePort`：
    ```bash
    # 假设 HTTP 的 NodePort 是 32080
    curl http://webapp.example.com:32080 
    ```

如果一切正常，您将看到 Nginx 的欢迎页面，证明 Ingress 已成功将流量转发至 `my-webapp-svc`。

---

## 解惑：NodePort 与路径路由的关系

一个常见疑问是：既然 Ingress 能够基于域名和路径进行七层路由，为什么访问时还需要带上 `NodePort` 端口？

答案在于流量的两个阶段：

1.  **从集群外部 到 Ingress Controller**：Ingress Controller 本身是运行在集群内的 Pod。在没有云厂商负载均衡器（LoadBalancer）的裸金属环境中，我们需要通过 `NodePort` 方式将 Controller 服务暴露给外部，以便流量能进入集群。这个 `NodePort`（如 `32080`）是 **Ingress Controller 的入口端口**，而非最终应用的端口。

2.  **从 Ingress Controller 到 最终服务**：一旦流量通过 `NodeIP:NodePort` 到达 Ingress Controller，Controller 的智能路由功能便开始工作。它会解析请求的 Host 头（`webapp.example.com`）和路径（`/`），匹配已创建的 Ingress 规则，然后在**集群内部**将流量转发到目标 Service（`my-webapp-svc`）的 `80` 端口。

可以把这个过程类比为进入一栋办公楼：

| K8s 概念 | 办公楼类比 |
| :--- | :--- |
| **Node IP** | 办公楼的街道地址 |
| **NodePort (e.g., :32080)** | 办公楼的特定入口（如员工通道）门牌号 |
| **Ingress Controller** | 站在入口处的智能前台 |
| **Ingress 规则** | 前台手里的访客登记表 |
| **Host/Path** | 您告知前台：“我要找 `Example` 公司，访问他们的 `/` 部门” |
| **Service & Port** | 前台查表后，指引您去 `8` 楼的 `WebApp` 办公室 |

### 生产环境架构

在生产环境中，为隐藏 `NodePort` 并使用标准的 80/443 端口，通常会在 Kubernetes 集群**前**部署一个外部负载均衡器（如 HAProxy、F5 或云厂商的 LB）。

*   **外部 LB 配置**：监听 80/443 端口，并将流量转发至后端所有 K8s 节点的 `NodePort`（如 `192.168.1.101:32080`, `192.168.1.102:32080`...）。

最终流量路径为：`用户` → `外部 LB (80/443)` → `K8s 节点:NodePort` → `Ingress Controller` → `目标服务`。

---

## 进阶：配置多路径路由

Ingress 的核心优势之一是能够基于同一域名，根据不同路径将流量分发到不同服务。

#### 场景示例

假设我们有两个服务：
*   `frontend-svc`: 提供 Web UI，通过根路径 `/` 访问。
*   `backend-api-svc`: 提供数据 API，通过 `/api` 前缀访问。

#### Ingress YAML 配置

可以修改 Ingress 资源，在 `paths` 数组中定义多条规则：

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: multi-path-ingress
spec:
  ingressClassName: nginx
  rules:
  - host: "webapp.example.com"
    http:
      paths:
      # 规则一：将根路径及其子路径转发到前端服务
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-svc # 指向前端服务
            port:
              number: 80
              
      # 规则二：将 /api/ 开头的路径转发到后端 API 服务
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend-api-svc # 指向后端 API 服务
            port:
              number: 8080 # 假设 API 服务端口为 8080
```

#### 关键点

*   **`paths` 数组**：允许在同一个 `host` 下定义多个路径规则。
*   **匹配优先级**：Ingress Controller 通常优先匹配最长、最精确的路径。因此，对 `webapp.example.com/api/users` 的请求会由 `path: /api` 规则处理，而不是 `path: /`。
*   **`pathType`**:
    *   **`Prefix`** (前缀匹配): `path` 的值被视为前缀，如 `path: /api` 会匹配 `/api`, `/api/` 和 `/api/v1/users` 等。
    *   **`Exact`** (精确匹配): URL 路径必须与 `path` 的值完全相同。

#### 路由结果

| 用户访问的 URL | Ingress 匹配的路径 | 最终转发到的服务 |
| :--- | :--- | :--- |
| `http://webapp.example.com/` | `/` | `frontend-svc` |
| `http://webapp.example.com/about.html` | `/` | `frontend-svc` |
| `http://webapp.example.com/api/v1/login` | `/api` | `backend-api-svc` |
| `http://webapp.example.com/api/status` | `/api` | `backend-api-svc` |

通过这种方式，仅需暴露 Ingress Controller 的单一入口，即可灵活管理集群内所有需要对外暴露的 HTTP 服务。