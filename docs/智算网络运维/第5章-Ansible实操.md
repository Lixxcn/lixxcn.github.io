# 第五章：Ansible 实操

本章聚焦于 Ansible 的动手实践，从核心的 Playbook 编写到进阶的角色应用，旨在通过具体案例，让读者熟练掌握使用 Ansible 进行自动化部署和管理的能力。

---

## 第1节：Ansible Playbook 核心实践

### 5.1 Playbook 结构与核心组件

-   **Playbook 结构**: 再次强调，Playbook 是由一个或多个 Play 组成的 YAML 文件。每个 Play 的核心是 `hosts` 和 `tasks`。
-   **核心组件实践**: `handlers` 和 `notify` 是实现服务状态管理的常用组合。
    -   **`notify`**: 在一个 `task` 中，如果其状态发生了改变（例如，配置文件被更新），它可以通过 `notify` 指令触发一个或多个 `handler`。
    -   **`handlers`**: `handler` 本质上也是一个 `task`，但它只有在被 `notify` 触发时才会执行。这确保了服务只在必要时才重启，避免了不必要的服务中断。

    **示例：更新 Nginx 配置并重启服务**
    ```yaml
    - hosts: webservers
      tasks:
        - name: Copy nginx config file
          copy:
            src: files/nginx.conf
            dest: /etc/nginx/nginx.conf
          notify: Restart Nginx

      handlers:
        - name: Restart Nginx
          service:
            name: nginx
            state: restarted
    ```

### 5.2 模块应用

-   **掌握常用模块**: 熟练使用 `copy`, `template`, `file`, `yum`/`apt`, `service`, `command`, `shell` 等模块是编写 Playbook 的基础。
-   **`template` vs `copy`**: `copy` 模块只是简单地复制文件，而 `template` 模块会使用 Jinja2 模板引擎对文件进行渲染，将变量替换为实际值后再复制到目标主机。这在需要为不同主机生成不同配置文件时非常有用。

### 5.3 变量与调试

-   **变量定义与作用域**: 掌握在不同位置（`vars` 块、`vars_files`、`group_vars`/`host_vars`、命令行）定义变量的方法及其优先级。
-   **基础调试技巧**:
    -   **`-v`, `-vv`, `-vvv`**: 增加 Ansible 输出的详细程度，帮助定位问题。
    -   **`--check` (Check Mode)**: “演习”模式。Ansible 会检查任务将要做的更改，但不会实际执行它们。
    -   **`--diff`**: 当文件内容发生变化时，显示具体的差异。
    -   **`debug` 模块**: 在 Playbook 中打印变量的值或自定义信息，是调试的利器。

        ```yaml
        - name: Debug OS Family
          debug:
            var: ansible_facts['os_family']
        ```

### 5.4 实践案例：自动化部署 Nginx

-   **目标**: 编写一个 Playbook，完成在指定主机上安装 Nginx、推送自定义首页、并启动服务的全过程。
-   **步骤**:
    1.  **安装 Ansible**: 在控制节点上安装 Ansible。
    2.  **创建 Inventory**: 定义要管理的 `webservers` 主机组。
    3.  **创建 Playbook (`deploy_nginx.yml`)**:
        -   使用 `yum` 或 `apt` 模块安装 Nginx。
        -   使用 `copy` 或 `template` 模块将一个自定义的 `index.html` 文件部署到 Nginx 的网站根目录。
        -   使用 `service` 模块确保 Nginx 服务已启动并设置为开机自启。
    4.  **应用条件判断 (`when`)**: 可以在 Playbook 中加入 `when` 条件，使其能够同时兼容 CentOS 和 Ubuntu 系统（例如，根据 `ansible_facts['os_family']` 的值选择使用 `yum` 还是 `apt` 模块）。

---

## 第2节：Ansible 进阶应用与角色实践

### 5.5 角色核心与结构

-   **角色核心作用**: **解耦**和**复用**。将一个复杂的部署任务（如部署一个 LAMP 应用）分解为多个独立的角色（如 `apache`, `mysql`, `php`），使 Playbook 更加清晰、易于管理和分享。
-   **掌握标准化目录结构**: 严格遵循官方推荐的角色目录结构是编写高质量角色的前提。

### 5.6 `ansible-galaxy`

-   **`ansible-galaxy`**: 是 Ansible 官方的用于管理角色的命令行工具。
    -   `ansible-galaxy init <role_name>`: 快速创建一个符合标准结构的角色骨架。
    -   `ansible-galaxy install <role_name>`: 从 Ansible Galaxy 社区或其他 Git 仓库安装别人分享的角色。
    -   `ansible-galaxy list`: 列出已安装的角色。

### 5.7 协同工作与调用

-   **协同工作**: 理解角色内部各部分（`tasks`, `vars`, `templates`, `handlers`）是如何协同工作的。例如，`tasks/main.yml` 中的任务可以 `notify` `handlers/main.yml` 中的处理器，并使用 `vars/main.yml` 中定义的变量和 `templates/` 目录下的模板。
-   **调用方法**: 掌握在主 Playbook 中通过 `roles:` 列表调用一个或多个角色的方法。理解角色的执行顺序以及变量的覆盖关系。

### 5.8 实践案例：创建 Nginx 角色并管理定时任务

-   **目标**: 将上一节的 Nginx 部署 Playbook 改造为一个标准化的角色，并使用 `cron` 模块添加一个定时任务。
-   **步骤**:
    1.  **创建角色**: 使用 `ansible-galaxy init nginx_role` 创建角色骨架。
    2.  **组织角色内容**: 
        -   将安装、配置、启停 Nginx 的任务写入 `nginx_role/tasks/main.yml`。
        -   如果需要，将 Nginx 配置文件模板放入 `nginx_role/templates/`。
        -   将重启 Nginx 的 handler 放入 `nginx_role/handlers/main.yml`。
    3.  **创建主 Playbook 调用角色**: 创建一个新的 Playbook，使用 `roles:` 关键字调用 `nginx_role`。
    4.  **使用 `cron` 模块**: 在角色的 `tasks/main.yml` 中，增加一个新任务，使用 `cron` 模块来创建一个定时任务（例如，每天定时备份 Nginx 日志）。

        ```yaml
        - name: Add cron job for log rotation
          cron:
            name: "Rotate Nginx Logs"
            minute: "0"
            hour: "2"
            job: "/usr/sbin/logrotate /etc/logrotate.d/nginx"
        ```