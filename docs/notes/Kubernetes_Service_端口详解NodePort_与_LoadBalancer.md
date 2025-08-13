# Kubernetes Service 端口详解：NodePort 与 LoadBalancer

在 Kubernetes 中，Service 是将运行在一组 Pod 中的应用程序暴露给网络请求的抽象层。理解 Service 的端口配置对于正确部署和访问应用程序至关重要。本文将详细解析 Kubernetes 中常见的 `NodePort` 和 `LoadBalancer` 类型的 Service 及其端口含义。

## Kubernetes Service 概览

Service 定义了访问 Pod 的策略。当 Pod 副本发生变化或 Pod IP 地址改变时，Service 能够提供一个稳定的访问入口。通过 `kubectl get service` 命令，我们可以获取到 Service 的详细信息，包括其类型、IP 地址以及最为关键的端口配置。

以下是一个典型的 `kubectl get all` 命令输出示例，我们将以此为例进行分析：

```
NAME                                        READY   STATUS    RESTARTS   AGE
pod/litellm-cu-deployment-c77c9cb87-x8cr7   1/1     Running   0          9m51s

NAME                                     TYPE           CLUSTER-IP       EXTERNAL-IP     PORT(S)          AGE
service/litellm-cu-deployment-opsagent   LoadBalancer   11.254.169.175   172.24.131.55   5000:36181/TCP   3m42s
service/litellm-cu-service               NodePort       11.254.91.143    <none>          80:46194/TCP     9m51s

NAME                                    READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/litellm-cu-deployment   1/1     1            1           9m52s

NAME                                              DESIRED   CURRENT   READY   AGE
replicaset.apps/litellm-cu-deployment-c77c9cb87   1         1         1       9m52s
```

在 `PORT(S)` 列中，我们经常会看到 `ServicePort:NodePort/Protocol` 的格式，这表示了 Service 层面和节点层面的端口映射。

## `LoadBalancer` 类型的 Service 端口详解

以 `service/litellm-cu-deployment-opsagent` 为例：

```
NAME                                     TYPE           CLUSTER-IP       EXTERNAL-IP     PORT(S)          AGE
service/litellm-cu-deployment-opsagent   LoadBalancer   11.254.169.175   172.24.131.55   5000:36181/TCP   3m42s
```

* **`TYPE: LoadBalancer`**:

  * 当 Service 类型被定义为 `LoadBalancer` 时，Kubernetes 会请求云服务提供商（如 AWS、GCP、Azure 等）在集群外部创建一个专用的负载均衡器。
  * 这个外部负载均衡器会获得一个 `EXTERNAL-IP`（在此例中为 `172.24.131.55`），负责接收来自互联网的流量，并将其转发到 Kubernetes 集群内部。
* **`PORT(S): 5000:36181/TCP`**: 这里的端口定义包含两部分关键信息：

  * **`5000` (ServicePort)**: 这是负载均衡器对外暴露的端口，也是 Service 在其 `CLUSTER-IP` (`11.254.169.175`) 上监听的端口。外部用户或外部系统通过负载均衡器的 `EXTERNAL-IP:ServicePort`（即 `172.24.131.55:5000`）来访问此服务。
  * **`36181` (NodePort)**: 这是 Kubernetes 集群中每个节点（Node）上开放的端口。当外部负载均衡器接收到 `5000` 端口的流量后，它会将流量转发到集群内的任意一个工作节点（Node）的 `36181` 端口。然后，该节点上的 kube-proxy 组件会将流量进一步路由到 Service 后端对应的 Pod。NodePort 的默认范围通常是 30000-32767，但也可以被管理员自定义。
  * **`/TCP`**: 表明使用的协议是 TCP。

**工作流程总结：**

外部用户 (`EXTERNAL-IP:ServicePort`) → 外部负载均衡器 → 集群内任一节点 (`NodeIP:NodePort`) → Service (`CLUSTER-IP:ServicePort`) → 后端 Pod (`PodIP:TargetPort`)

## `NodePort` 类型的 Service 端口详解

以 `service/litellm-cu-service` 为例：

```
NAME                                     TYPE           CLUSTER-IP       EXTERNAL-IP     PORT(S)          AGE
service/litellm-cu-service               NodePort       11.254.91.143    <none>          80:46194/TCP     9m51s
```

* **`TYPE: NodePort`**:

  * 当 Service 类型被定义为 `NodePort` 时，Kubernetes 会在集群中每个工作节点（Node）的 IP 地址上开放一个静态端口。
  * 通过任意一个节点的 IP 地址和这个 `NodePort`，就可以从集群外部直接访问此 Service。它不依赖于云服务商的负载均衡器，是基础的外部暴露方式。
* **`PORT(S): 80:46194/TCP`**:

  * **`80` (ServicePort)**: 这是 Service 在**集群内部**通过其 `CLUSTER-IP` (`11.254.91.143`) 暴露的端口。集群内部的其他 Pod 可以通过 `CLUSTER-IP:ServicePort`（即 `11.254.91.143:80`）来访问 `litellm-cu-service`。
  * **`46194` (NodePort)**: 这是 Kubernetes 集群中每个节点（Node）开放的特定端口。你可以通过 `任何一个Kubernetes节点的IP地址:NodePort`（即 `NodeIP:46194`）来从集群外部访问此 Service。流量会直接到达节点，然后由节点的 kube-proxy 转发到 Service 后端对应的 Pod。需要注意的是，尽管 NodePort 默认在 30000-32767 范围内，此处显示 `46194` 表明集群的 NodePort 范围可能已被管理员扩大，或者这是一个手动指定的 NodePort。
  * **`/TCP`**: 表示使用的协议是 TCP。

**工作流程总结：**

外部用户 (`NodeIP:NodePort`) → 集群内任一节点 (`NodeIP:NodePort`) → Service (`CLUSTER-IP:ServicePort`) → 后端 Pod (`PodIP:TargetPort`)

## 核心概念补充：`TargetPort`

在上述 Service 端口的描述中，虽然没有直接在 `PORT(S)` 列显示 `TargetPort`，但它是一个至关重要的概念：

* **`TargetPort`**: 这是 Service 最终将请求转发到后端 Pod 上**实际监听的端口**。应用程序（例如，一个 Web 服务器）在 Pod 内部监听的服务端口就是 `TargetPort`。例如，如果 `litellm` 应用程序在其容器内部监听 8080 端口，那么这个 Service 的 `targetPort` 就会配置为 8080。

Service 通过 `ServicePort` 接收请求，然后将其转发到 Pod 的 `TargetPort`。这种设计使得 Service 能够抽象化 Pod 的部署细节，提供了更大的灵活性和弹性。

## 总结

理解 `NodePort` 和 `LoadBalancer` 这两种 Service 类型的端口含义对于 Kubernetes 的网络管理和应用部署至关重要。`NodePort` 适用于简单的外部访问和测试，而 `LoadBalancer` 则更适合在云环境中需要高可用、高性能的生产级部署。通过合理配置 Service 端口，可以有效地将应用程序暴露给内部和外部用户。
