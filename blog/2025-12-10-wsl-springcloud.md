---
title: 【避坑指南】WSL/Windows下Spring Boot报错 "Port already in use" 但查不到占用？真相竟是Hyper-V！
authors: [lixx]
tags: [技术分享]
---

## 😡 遇到的问题

最近在 WSL (Windows Subsystem for Linux) 环境下启动 Spring Boot 项目时，遇到了一个让人极其崩溃的问题。

项目启动失败，报错非常明确：
```
***************************
APPLICATION FAILED TO START
***************************

Description:

Web server failed to start. Port 9385 was already in use.

Action:

Identify and stop the process that's listening on port 9385 or configure this application to listen on another port.
```

## 🕵️‍♂️ 诡异的排查过程

看到这个报错，第一反应肯定是端口被占用了。于是我熟练地敲下命令：

**1. 在 WSL 里查：**
```bash
netstat -tlnp | grep 9385
# 没有任何输出
```

**2. 在 Windows CMD 里查：**
```powershell
netstat -ano | findstr 9385
# 也没有任何输出
```

这就见鬼了！**WSL 里没有进程，Windows 里也没有进程，但 Spring Boot 就是死活报端口被占用。**

中间我还尝试了各种“玄学”疗法：
*   修改 `/etc/hosts` 文件，以为是 `localhost` 解析问题。
*   关掉公司 VPN，以为是网络代理干扰。
*   强制指定 `-Djava.net.preferIPv4Stack=true`。

折腾了一上午，结果依然是 `Port 9385 was already in use`。

## 🔍 真相大白：Windows 的“隐形”保留机制

最后在一位大佬的指点下，我发现虽然**没有进程**占用这个端口，但是**Windows 系统本身**把这个端口给“征用”了。

这是 Windows Hyper-V（WSL 2 依赖它）的一个机制：它会随机保留一段端口范围，用于容器网络或 NAT 转发。如果你的应用端口不幸落在这个范围内，应用就没有权限绑定该端口，从而报出“端口被占用”。

**验证方法：**

在 Windows 打开 **管理员权限** 的 PowerShell 或 CMD，输入：

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

我的输出如下（注意看 9350 - 9449 这一行）：
```text
协议 tcp 端口排除范围

开始端口    结束端口
----------    --------
      ...
      2709        2808      
      9350        9449  <--- 凶手在这里！
     10213       10312
      ...
     50000       50059     *
```

我的项目端口是 **9385**，正好处于 `9350` 到 `9449` 这个保留范围内！
所以，哪怕没有进程在跑，这个端口我也用不了。

## 🛠️ 解决方案

找到了原因，解决就很简单了。

### 方法一：惹不起，躲得起（推荐）

既然系统霸占了这个范围，那我们换个端口就行了。
修改 `application.yml` 或启动参数，避开 `excludedportrange` 列出的范围。

比如我改成了 20000+ 的端口，瞬间启动成功，丝滑流畅。

```yaml
server:
  port: 29385
```

### 方法二：重启 WinNAT 服务（重置随机范围）

如果你非要用这个端口（比如微服务规定了端口），可以通过重启 Windows 的网络地址转换服务来“洗牌”这个随机范围。

在管理员 PowerShell 中依次执行：

```powershell
net stop winnat
net start winnat
```

重启后，保留的端口范围会发生变化，如果运气好，你的端口就被释放出来了。

### 方法三：永久保留端口（一劳永逸）

为了防止以后重启电脑后端口又被随机征用，可以先把这个端口“抢注”下来：

```powershell
# 先停止服务
net stop winnat
# 显式排除你需要用的端口（比如 9385）
netsh int ipv4 add excludedportrange protocol=tcp startport=9385 numberofports=1
# 重启服务
net start winnat
```

## 📝 总结

如果你在 Windows 或 WSL 下开发 Java/Node/Python 程序，遇到 `BindException: Access denied` 或 `Port already in use`，但 `netstat` 却查不到任何进程：

1.  **不要怀疑代码**。
2.  **不要怀疑 Hosts 文件**。
3.  **立刻运行 `netsh interface ipv4 show excludedportrange protocol=tcp`**。

这个坑太深了，记录下来希望能帮到遇到同样问题的兄弟们！