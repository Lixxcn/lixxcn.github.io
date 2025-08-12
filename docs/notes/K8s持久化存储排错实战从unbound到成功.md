# K8s持久化存储排错实战：从unbound到成功

在 Kubernetes (K8s) 环境中，持久化存储是部署有状态应用不可或缺的一环。然而，对于初次接触或使用 `kubeadm` 搭建干净集群的开发者来说，PVC (PersistentVolumeClaim) 相关的错误常常是第一道坎。本文将根据一次完整的排错过程，系统性地梳理从 `pod has unbound immediate PersistentVolumeClaims` 到最终成功挂载的典型问题与解决方案。

## 阶段一：初始错误 `pod has unbound immediate PersistentVolumeClaims`

当在一个新搭建的 K8s 集群中部署需要存储的应用时，你很可能会遇到 Pod 无法启动，并伴随以下调度失败的事件：

```
0/1 nodes are available: pod has unbound immediate PersistentVolumeClaims.
```

### 问题诊断：集群缺少存储供应器 (Storage Provisioner)

此错误的核心原因分解如下：

1.  **`pod has unbound ... PersistentVolumeClaims`**: 应用的 Pod 定义了一个或多个 PVC，用以申请存储资源。`unbound` 状态表示 K8s 未能为该 PVC 找到匹配的 PV (PersistentVolume) 进行绑定。
2.  **`immediate`**: 这表明 PVC 关联的 `StorageClass` 其 `volumeBindingMode` 设置为 `Immediate`（默认值）。该模式要求在 Pod 被调度到节点前，必须先完成 PV 和 PVC 的绑定。由于绑定失败，调度流程从一开始便被阻塞。
3.  **根本原因**: 使用 `kubeadm` 等工具创建的“干净”集群，默认不包含任何存储解决方案，即**存储供应器 (Storage Provisioner)**。没有供应器，就没有任何组件能够响应 PVC 的请求来动态创建 PV，导致 PVC 永远处于 `Pending` 状态。

### 解决方案：安装 `local-path-provisioner`

对于单节点或开发测试环境，最快捷的解决方案是安装一个利用节点本地磁盘路径来提供存储的供应器，例如 `local-path-provisioner`。

1.  **安装 `local-path-provisioner`**

    执行以下命令，该命令会创建一个名为 `local-path-provisioner` 的 Deployment 和一个名为 `local-path` 的 StorageClass。
    ```bash
    kubectl apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.26/deploy/local-path-storage.yaml
    ```

2.  **（推荐）设置默认 StorageClass**

    将 `local-path` 设为默认，这样未来创建 PVC 时若不显式指定 `storageClassName`，将自动使用它。
    ```bash
    kubectl patch storageclass local-path -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
    ```
    现在执行 `kubectl get sc`，应看到 `local-path` 后有 `(default)` 标记。

3.  **清理并重新部署**

    删除因存储问题而失败的旧资源，然后重新应用配置。
    ```bash
    # 删除旧的、处于 Pending 状态的 PVC 和无法调度的 Deployment
    kubectl delete pvc <your-pvc-name>
    kubectl delete deployment <your-deployment-name>
    
    # 重新部署应用
    kubectl apply -f <your-app.yaml>
    ```

## 阶段二：新挑战 `ProvisioningFailed` 与访问模式

安装存储供应器后，部分 PVC 可能仍处于 `Pending` 状态，并出现新的错误日志：

```
Warning  ProvisioningFailed  ...  failed to provision volume with StorageClass “local-path”: NodePath only supports ReadWriteOnce and ReadWriteOncePod (1.22+) access modes
```

### 问题诊断：访问模式 (Access Modes) 不匹配

此错误信息非常明确：`local-path-provisioner` 拒绝创建 PV，因为 PVC 请求的访问模式不被支持。

-   **`ReadWriteOnce` (RWO)**：卷可被**单个节点**以读写方式挂载。多个 Pod 可使用，但它们必须位于同一节点。
-   **`ReadWriteMany` (RWX)**：卷可被**多个节点**同时以读写方式挂载。这需要共享文件系统（如 NFS, CephFS）的支持。
-   **`local-path-provisioner` 的局限性**: 它在节点的本地磁盘上创建目录作为存储。这种存储本质上与特定节点绑定，无法被网络上其他节点直接访问，因此天然**不支持 `ReadWriteMany` (RWX)**。

根本原因在于，应用的 PVC 定义中请求了 `ReadWriteMany`，而 `local-path` 存储类只能提供 `ReadWriteOnce`。

## 阶段三：终极解决：不可变性与声明式管理

一个直接的想法是手动编辑已存在的 PVC，将其访问模式从 `ReadWriteMany` 改为 `ReadWriteOnce`。

```bash
kubectl edit pvc dify
```

然而，此操作会失败并返回如下错误：

```
persistentvolumeclaims "dify" was not valid:
* spec: Forbidden: spec is immutable after creation except resources.requests...
```

### 问题诊断：Kubernetes 资源对象的不可变性 (Immutability)

这个错误揭示了 Kubernetes 的一个核心设计原则：**许多核心对象的关键 `spec` 字段在创建后是不可变的**。`accessModes` 就是其中之一。此设计旨在保证集群状态的稳定性和可预测性，防止对已生效资源进行破坏性更改。

因此，直接编辑线上资源（Live Object）的不可变字段是行不通的。

### 正确的解决方案：修改源文件并重建

正确的做法是遵循 Kubernetes 的声明式配置管理范式：**当线上资源配置错误且不可更改时，应修改其源配置文件（Source YAML），然后删除旧资源，最后重新应用配置**。

1.  **修改应用的源 YAML 文件**
    找到部署应用的 `.yaml` 文件，定位到 `kind: PersistentVolumeClaim` 的部分，将其 `accessModes` 从 `ReadWriteMany` 改为 `ReadWriteOnce`。

    **修改前**:
    ```yaml
    apiVersion: v1
    kind: PersistentVolumeClaim
    metadata:
      name: dify
    spec:
      accessModes:
        - ReadWriteMany  # <-- 问题所在
      resources:
        requests:
          storage: 5Gi
      storageClassName: local-path
    ```

    **修改后**:
    ```yaml
    apiVersion: v1
    kind: PersistentVolumeClaim
    metadata:
      name: dify
    spec:
      accessModes:
        - ReadWriteOnce  # <-- 修改为此
      resources:
        requests:
          storage: 5Gi
      storageClassName: local-path
    ```

2.  **删除旧的、配置错误的资源**
    为确保干净的重建环境，请删除相关的 PVC 和管理它的控制器（如 Deployment）。
    ```bash
    kubectl delete pvc dify dify-plugin-daemon
    kubectl delete deployment dify-api dify-worker
    ```

3.  **重新应用修改后的配置文件**
    ```bash
    kubectl apply -f <你修改后的dify应用.yaml>
    ```

4.  **验证结果**
    稍等片刻后，检查 PVC 和 Pod 的状态，它们应能顺利进入 `Bound` 和 `Running` 状态。
    ```bash
    kubectl get pvc
    kubectl get pods
    ```

## 备选方案：当应用必须使用 RWX

如果你的应用逻辑确实需要跨节点读写共享（`ReadWriteMany`），那么 `local-path-provisioner` 将不再适用。你需要一个支持 RWX 的存储后端，例如 **NFS (网络文件系统)**。

大致步骤如下：
1.  **搭建 NFS Server**：在网络中或某个节点上设置一个 NFS 服务端并导出一个共享目录。
2.  **安装 NFS 客户端**：确保所有 K8s 工作节点都安装了 NFS 客户端工具。
3.  **在 K8s 中部署 NFS Provisioner**：例如 `nfs-subdir-external-provisioner`，它会自动监听 RWX 类型的 PVC 请求，并在 NFS 服务器上创建子目录来满足它们。
4.  **创建新的 `StorageClass`**：此 StorageClass 将指向 NFS Provisioner。
5.  **修改应用 PVC**：将 PVC 的 `storageClassName` 指向新的 NFS 存储类，并保留 `accessModes` 为 `ReadWriteMany`。

## 总结

| 排错阶段 | 遇到的问题 | 核心原因 | 正确的解决方案 |
| :--- | :--- | :--- | :--- |
| **阶段一** | `pod has unbound immediate PersistentVolumeClaims` | `kubeadm` 创建的集群默认无存储供应器 (Storage Provisioner)。 | 安装 `local-path-provisioner` 并将其设为默认 `StorageClass`。 |
| **阶段二** | `ProvisioningFailed ... only supports ReadWriteOnce` | 应用 PVC 请求了 `ReadWriteMany` (RWX)，但 `local-path-provisioner` 只支持 `ReadWriteOnce` (RWO)。 | 确认应用是否需要 RWX。如果不需要，继续下一阶段；如果需要，则更换为支持 RWX 的存储方案（如 NFS）。 |
| **阶段三** | `spec: Forbidden: spec is immutable after creation` | 尝试用 `kubectl edit` 修改 PVC 的 `accessModes`，但该字段是不可变的。 | **修改源 YAML 文件**，将 `accessModes` 改为 `ReadWriteOnce`，然后**删除旧资源**并**重新应用配置**。 |