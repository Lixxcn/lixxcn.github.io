# 第三章：自动化运维工具 Ansible

本章将介绍业界主流的自动化运维工具 Ansible。从其核心概念、工作原理到 Playbook 的编写和角色的使用，帮助读者掌握使用 Ansible 实现IT自动化管理的能力。

---

## 第1节：Ansible 基础概念与核心原理

### 3.1 传统运维的痛点与 Ansible 的优势

-   **传统运维的劣势**:
    -   **重复性手动操作**: 大量服务器的配置、部署、更新等任务需要手动重复执行，效率低下且容易出错。
    -   **脚本维护复杂**: 使用 Shell、Python 等脚本进行自动化，虽然可行，但随着规模扩大，脚本的编写、维护、复用和扩展变得异常困难，缺乏标准化。
    -   **缺乏一致性**: 不同管理员、不同时间的操作可能导致环境配置不一致，为故障排查埋下隐患。

-   **Ansible 定义与特点**:
    -   **定义**: Ansible 是一款极其简单的开源 IT 自动化工具，它可以帮助用户配置系统、部署软件、编排更高级的 IT 任务，如持续部署或零停机滚动更新。
    -   **核心特点**:
        1.  **简单 (Simple)**: 使用 YAML 语言编写 Playbook，语法简单，可读性高，接近自然语言。
        2.  **无代理 (Agentless)**: Ansible 无需在被管理节点上安装任何客户端或代理程序。它通过标准的 SSH 协议（Linux/Unix）或 WinRM（Windows）进行通信，降低了管理开销和安全风险。
        3.  **幂等性 (Idempotent)**: 这是 Ansible 的一个核心特性。一个操作无论执行一次还是多次，结果都是相同的。例如，一个任务是“确保某个文件存在”，如果文件已存在，Ansible 不会做任何更改；如果不存在，则会创建它。这保证了操作的可预测性和安全性。
        4.  **模块化 (Modular)**: Ansible 拥有数千个内置模块，覆盖了系统管理、网络配置、云服务管理等方方面面。用户只需调用这些模块，即可完成复杂的任务，无需编写底层代码。

### 3.2 Ansible 核心组件与工作流程

-   **任务执行流程**: Ansible 的工作流程非常直观：
    1.  用户在**控制节点 (Control Node)**（安装了 Ansible 的机器）上编写 Playbook 或执行 Ad-Hoc 命令。
    2.  Ansible 读取**资产文件 (Inventory)**，确定要操作的**被管理节点 (Managed Nodes)**。
    3.  Ansible 通过 SSH 连接到被管理节点。
    4.  Ansible 将对应的 Python **模块 (Module)** 代码临时推送到被管理节点上。
    5.  在被管理节点上执行该模块，并收集执行结果。
    6.  删除临时模块文件，并将执行结果返回给控制节点，输出给用户。

-   **资产文件 (Inventory)**: Inventory 是一个定义了被管理主机列表的文件，默认路径为 `/etc/ansible/hosts`，也可以通过 `-i` 参数指定。它可以是 INI 或 YAML 格式。

    **INI 格式示例**:
    ```ini
    [webservers]
    web1.example.com
    web2.example.com ansible_user=admin

    [dbservers]
    db1.example.com
    db2.example.com

    [datacenter:children]
    webservers
    dbservers
    ```

-   **常用模块 (Modules)**: 模块是 Ansible 执行任务的核心。以下是一些基础且常用的模块：
    -   `ping`: 测试与主机的连通性，返回 `pong` 表示成功。
    -   `copy`: 从控制节点复制文件到被管理节点。
    -   `file`: 设置文件的属性，如创建、删除文件/目录，修改权限、所有者等。
    -   `service`: 管理系统服务，如启动、停止、重启服务。
    -   `yum` / `apt`: 管理基于 YUM 或 APT 的软件包。
    -   `command`: 在远程主机上执行命令。此模块不会通过 shell 处理，因此不支持管道、重定向等 shell 特性。
    -   `shell`: 与 `command` 类似，但在远程主机的 shell 中执行命令，支持管道、重定向等。

---

## 第2节：Playbook 语法

Playbook 是 Ansible 的配置、部署和编排语言。它们是描述策略的 YAML 文件，您希望远程系统强制执行这些策略。

### 3.3 YAML 基础

-   **YAML (YAML Ain't Markup Language)** 是一种数据序列化语言，以其简洁和可读性著称。
    -   **缩进**: 使用缩进表示层级关系，通常为2个空格，**严禁使用 Tab**。
    -   **列表 (List/Array)**: 以 `-` 开头的行是一个列表项。
    -   **字典 (Dictionary/Map)**: 以 `key: value` 的形式表示，冒号后必须有空格。

### 3.4 Playbook 核心概念

一个 Playbook 由一个或多个 **Play** 组成。一个 Play 包含以下核心元素：

```yaml
---
- name: My First Play
  hosts: webservers
  become: yes
  vars:
    package_name: nginx

  tasks:
    - name: Install nginx
      yum:
        name: "{{ package_name }}"
        state: present

  handlers:
    - name: restart nginx
      service:
        name: nginx
        state: restarted
```

-   `hosts`: 指定这个 Play 将要作用于 Inventory 中的哪个主机或主机组。
-   `tasks`: 任务列表。每个任务按顺序执行，核心是调用一个模块。
-   `vars`: 定义变量。
-   `handlers`: 处理器。只有在被 `notify` 指令触发时才会执行，通常用于服务重启等操作。
-   `roles`: 引用角色，用于组织和复用 Playbook。

### 3.5 变量、模板与流程控制

-   **变量 (Variables)**: 变量可以定义在 Playbook、Inventory、独立文件或命令行中，增加了 Playbook 的灵活性。
-   **Jinja2 模板**: Ansible 使用 Jinja2 模板引擎来处理动态内容。所有被 `{{ ... }}` 包围的内容都会被 Ansible 视为变量或表达式进行替换。
-   **循环 (`loop`)**: 当需要对一组项目执行相同任务时，使用循环。

    ```yaml
    - name: create multiple users
      user:
        name: "{{ item }}"
        state: present
      loop:
        - alice
        - bob
    ```

-   **条件 (`when`)**: 当需要根据特定条件决定是否执行一个任务时，使用 `when`。

    ```yaml
    - name: shutdown debian systems
      command: /sbin/shutdown -h now
      when: ansible_facts['os_family'] == "Debian"
    ```

### 3.6 角色 (Roles)

-   **概念与优势**: 角色是组织 Playbook 内容（任务、变量、处理器等）的一种结构化方式。其主要优势是**结构化**和**可复用**。一个复杂的 Playbook 可以被拆分成多个角色，每个角色负责一个特定的功能（如配置Nginx、部署数据库），然后在主 Playbook 中调用这些角色。
-   **标准目录结构**: 一个典型的角色目录结构如下：

    ```
    roles/
        my_role/
            tasks/main.yml
            handlers/main.yml
            vars/main.yml
            defaults/main.yml
            templates/
            files/
            meta/main.yml
    ```

    -   `tasks/main.yml`: 角色的主要任务文件。
    -   `handlers/main.yml`: 角色的处理器文件。
    -   `vars/main.yml`: 角色的变量文件。
    -   `defaults/main.yml`: 角色的默认变量文件，优先级最低。
    -   `templates/`: 存放 Jinja2 模板文件。
    -   `files/`: 存放需要被复制到被管理节点的文件。

-   **使用角色**: 在 Playbook 中通过 `roles` 关键字调用角色。

    ```yaml
    - hosts: webservers
      roles:
        - common
        - nginx_role
    ```