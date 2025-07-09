# 读懂 Ansible 剧本

你可以把一个 Ansible Playbook（`.yml` 文件）想象成一个**剧本**。这篇笔记将带你从零开始，彻底理解一个剧本的构成，让你能看懂并写出自己的自动化任务。

* **Playbook (剧本)**: 整个文件，定义了要完成的一系列任务。
* **Play (戏剧/任务集)**: 剧本由一个或多个 `Play` 组成。每个 Play 都是一个顶级 `YAML` 列表项（以 `-` 开头）。它定义了**“谁”（目标主机）**来**“做什么”（一系列任务）**。
* **Task (任务)**: 每个 Play 包含一系列 `Task`。这些是具体的**“动作”**，比如执行一个命令、安装一个软件。
* **Module (模块)**: 每个 Task 都通过调用一个 Ansible `Module` 来执行。`shell`、`file`、`set_fact` 都是模块。

---

### 一、 Play 的关键指令：定义“谁”和“环境”

Play 是你的 `YAML` 文件中的顶级 `-` 元素，它定义了任务执行的上下文。一个典型的 Playbook 采用“**采集-汇总**”模式，包含两个 Play：第一个在所有目标机上采集信息，第二个在本地汇总。

```yaml
# Play 1: 在所有目标主机上执行
- hosts: all
  become: yes
  become_user: root
  gather_facts: true
  tasks:
    - ...

# Play 2: 仅在本地执行
- hosts: localhost
  gather_facts: false
  vars:
    counts: 0
  tasks:
    - ...
```

* `hosts`: **定义目标主机**。这是 Play 中最重要的部分。

  * `all`: 表示 Ansible 主机清单（inventory）中的所有主机。
  * `localhost`: 表示仅在运行 Ansible 命令的本机上执行。
  * 也可以是主机组名（如 `webservers`）、具体 IP 或域名。
* `become` / `become_user`: **提权设置**。

  * `become: yes`: 相当于 `sudo`，告诉 Ansible 需要提升权限来执行任务。
  * `become_user: root`: 指定要切换到的用户，通常是 `root`。
* `gather_facts`: **收集“事实”**。

  * `true`: 在执行 tasks 之前，Ansible 会自动连接到目标主机，收集关于该主机的各种信息（如操作系统 `ansible_distribution`、主机名 `ansible_hostname` 等）。这些信息被称为 "Facts"，可在后续任务中当做变量使用。
  * `false`: 跳过此步骤以提速，但 `ansible_` 开头的内置变量将无法使用。
* `vars`: **定义 Play 级别的变量**。在这里定义的变量，可以在当前 Play 的所有 `tasks` 中使用，通常用于设置初始值。

---

### 二、 Task 的关键指令：定义“做什么”

Tasks 是 Play 的核心，定义了具体要执行的操作。

```yaml
tasks:
  - name: 僵尸进程检测
    shell: ps -A -o stat,pid | grep -e ^[zZ]|awk {print $2}
    register: PID
    changed_when: false
    ignore_errors: true
    when: ansible_distribution == "Rocky"
```

* `name`: **任务的可读描述**。它会显示在 Ansible 的执行输出中，强烈建议为每个任务都写一个清晰的 `name`。
* `模块名`: 每个任务必须调用一个模块，如 `shell`, `set_fact`, `file`, `debug`。
* `register`: **注册变量**。这是 Ansible 中**极其重要**的指令。它会将一个任务的**执行结果**（包括标准输出、错误、返回码等）保存到一个你指定的变量中。

  * 例如，`register: PID` 后，你就可以通过 `PID.stdout` (标准输出字符串) 或 `PID.stdout_lines` (标准输出按行分割的列表) 来使用其结果。
* `when`: **条件判断**。只有当 `when` 后面的表达式为真（True）时，这个任务才会执行。
* `block`: **任务块**。可以将多个任务组织成一个逻辑单元，常与 `when` 结合，实现根据不同条件执行不同的一组任务，使逻辑非常清晰。
* `with_items`: **循环**。可以对一个列表进行迭代，对每个列表项都执行一次该任务。循环中，当前项的值会赋给 `item` 变量。
* `changed_when`: **自定义“变更”状态**。很多查询类命令并不实际改变系统状态，使用 `changed_when: false` 可以防止 Ansible 将其错误地标记为"changed"。
* `ignore_errors: true`: **忽略错误**。即使任务失败，Ansible 也会继续执行后续任务，而不是中断整个流程。

---

### 三、 Ansible 的魔法：变量、事实与 Jinja2

所有 `{{ ... }}` 语法都属于 Jinja2 模板引擎，它让 Playbook 变得动态和强大。

* **变量引用**: `{{ a_variable }}`

  * `{{ ansible_hostname }}`: 引用 `gather_facts` 收集到的主机名。
  * `{{ PID.stdout_lines }}`: 引用 `register` 注册的 `PID` 变量的 `stdout_lines` 属性。
* **过滤器 (Filter)**: 使用 `|` 管道符对变量进行处理，功能强大。

  * `| length`: 获取列表的**长度**或字符串的字符数。
  * `| replace('\n', '<br/>')`: 将字符串中的换行符 `\n` **替换**为 HTML 的 `<br/>`。
  * `| int`: 将变量的值**转换成整数**类型。
  * `| to_json`: 将复杂的变量（如字典或列表）**转换成 JSON 格式的字符串**。
* `set_fact`: 主动创建一个新变量（“事实”）。这个变量在当前主机的后续任务中都可以使用，非常适合用来整理和格式化数据。
* `hostvars`: **跨主机变量访问**。这是 Ansible 一个非常强大的特性，是“采集-汇总”模式的核心。

  * 它是一个特殊的、巨大的变量，包含了清单中**所有主机**的所有变量信息。
  * **用法**: `hostvars[主机名][变量名]`。
  * **应用**: 在 `localhost` 的 Play 中，汇总来自所有其他主机的数据。

    ```yaml
    - name: 整合结果
      set_fact:
        contents: "{{ contents + hostvars[item].content }}"
        counts: "{{ counts|int + hostvars[item].count|int }}"
      with_items: "{{ groups.all }}"
    ```

    这里的 `item` 就是通过 `with_items` 遍历得到的主机名。通过 `hostvars[item].content` 就可以精确地获取该 `item` 主机在第一个 Play 中通过 `set_fact` 设置的 `content` 变量的值。

### 四、深度解析：“列表累加”的秘密

在上面的例子中，`counts` 的累加是数字相加，很好理解。但 `contents` 的累加是什么意思？

对于列表（List/Array）来说，`+` 号操作符不是数字相加，而是 **列表拼接 (List Concatenation)**。它将两个列表合并成一个新列表。

我们来分解一下这个拼接过程，假设有两台服务器 `server1` 和 `server2`：

1. **初始状态**
   在 `localhost` 上，`contents` 变量初始值为：

   ```yaml
   contents:
     - hostname: ""
       result: ""
       # ... 其他空字段
   ```
2. **第一次循环 (`item` = server1)**

   * Ansible 从 `server1` 获取到 `hostvars[server1].content` 的值，假设是： `[{hostname: "server1", result: "无超多200个僵尸进程", ...}]`。
   * 执行拼接操作： `[{hostname: "", ...}] + [{hostname: "server1", ...}]`
   * `contents` 变量被更新为包含两个元素的列表。
3. **第二次循环 (`item` = server2)**

   * Ansible 从 `server2` 获取到 `hostvars[server2].content` 的值，假设是： `[{hostname: "server2", result: "有超过200个僵尸进程请处理", ...}]`。
   * 执行拼接操作： `[{hostname: "", ...}, {hostname: "server1", ...}] + [{hostname: "server2", ...}]`
   * `contents` 变量被更新为包含三个元素的列表。

循环结束后，`localhost` 上的 `contents` 变量就包含了一个由所有主机的巡检结果组成的、完整的列表，为最终生成报告做好了准备。
