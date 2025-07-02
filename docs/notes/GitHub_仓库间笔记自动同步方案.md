# GitHub 仓库间笔记自动同步方案

本文详细阐述了如何在使用 Docusaurus 部署的 GitHub Pages 仓库 (`lixxcn.github.io`) 和本地笔记同步工具的 GitHub 仓库 (`note-gen-sync`) 之间实现笔记的自动同步。核心思想是通过在 `note-gen-sync` 仓库中配置 GitHub Actions，将笔记自动推送到 `lixxcn.github.io` 仓库的 `docs` 目录下，从而触发 Docusaurus 的自动构建。

## 背景问题

用户期望在 `note-gen-sync` 仓库中编写的笔记，能够自动同步到部署了 Docusaurus 的 `lixxcn.github.io` 仓库的 `docs` 目录下。

## 解决方案概述

实现此功能主要有两种思路：

1.  **在 `note-gen-sync` 仓库中，通过 GitHub Actions 将笔记推送到 `lixxcn.github.io` 仓库。** （推荐且本文详述方案）
2.  在 `lixxcn.github.io` 仓库中，通过 GitHub Actions 将 `note-gen-sync` 仓库作为子模块或直接拉取内容。

本文将着重介绍并推荐**方案一**，因为它将同步逻辑放在笔记生成的源头，更为直接和方便。

## 方案一：在 `note-gen-sync` 仓库中配置 GitHub Actions（推荐）

这个方案的核心是，当 `note-gen-sync` 仓库有新的提交时，触发一个 GitHub Action，将最新的笔记文件复制并推送到 `lixxcn.github.io` 仓库的 `docs` 目录。

### 核心实现原理与私有仓库支持

即使 `note-gen-sync` 是一个**私有仓库**，而 `lixxcn.github.io` 是**公开仓库**，通过本方案也是完全可以实现的。核心在于**权限管理**。尽管 `note-gen-sync` 是私有仓库，但 GitHub Actions 跑在其中时，仍然需要权限去访问并修改 `lixxcn.github.io` 这个公开仓库。这个权限就是通过你设置的 **Deploy Key** 或 **Personal Access Token (PAT)** 来提供的。

### 关键点重申与确认：

1.  **Deploy Key 的选择 (推荐):**
    *   **在哪里生成？** Deploy Key 是绑定到**单个仓库**的。所以，你应该在 `lixxcn.github.io` 这个公开仓库中生成 Deploy Key。
    *   **权限设置？** 在生成时，务必勾选 **"Allow write access"**，因为 `note-gen-sync` 的 Actions 需要向 `lixxcn.github.io` 推送文件。
    *   **私钥存放在哪里？** 将 `lixxcn.github.io` 生成的 Deploy Key 的**私钥**，存放到 `note-gen-sync` 这个**私有仓库**的 GitHub Secrets 中。这样，只有在 `note-gen-sync` 仓库中运行的 Actions 才能访问这个密钥。
    *   **安全性：** Deploy Key 仅授权对一个特定仓库的访问。即使 `note-gen-sync` 的 Secrets 泄露了，这个密钥也只能作用于 `lixxcn.github.io` 仓库，而不能访问你其他任何仓库。

2.  **Personal Access Token (PAT) 的选择 (替代方式):**
    *   **在哪里生成？** PAT 是绑定到你的**用户账户**的。
    *   **权限设置？** 至少需要 `repo` 权限，这会允许对你所有（包括私有）仓库的读写访问。
    *   **令牌存放在哪里？** 将生成的 PAT 存放到 `note-gen-sync` 这个私有仓库的 GitHub Secrets 中。
    *   **安全性：** PAT 权限范围广，一旦泄露风险较高。
    *   **推荐：** 如果只为这个特定的同步需求，**Deploy Key 是更安全、更推荐的方案**。

### 详细步骤及代码示例：

#### 1. 在 `lixxcn.github.io` 仓库生成部署密钥（Deploy Key）

部署密钥允许你在其他服务或仓库中访问或写入当前仓库。

*   进入 `lixxcn.github.io` 仓库。
*   点击 **Settings** -> **Deploy keys** -> **Add deploy key**。
*   勾选 **Allow write access** (非常重要，因为你需要写入文件)。
*   给密钥起一个有意义的标题，例如 `NOTE_SYNC_KEY`。
*   将生成的公钥和私钥**都保存好**。公钥会粘贴到 GitHub 页面，私钥（通常是 `id_rsa` 文件内容）将在下一步用到。

**或者，使用 Personal Access Token (PAT)：**

如果你不希望为每个仓库单独设置 Deploy Key，或者需要更多灵活性，可以使用 PAT。
*   进入 GitHub -> **Settings** -> **Developer settings** -> **Personal access tokens** -> **Tokens (classic)** -> **Generate new token**.
*   勾选 `repo` 权限（包括 `repo:status`, `repo_deployment`, `public_repo`, `repo:invite` 等子权限）。这会给予对所有仓库的读写权限，所以要小心保管。
*   生成后，**请立即复制并保存好令牌**，因为你无法再次看到它。

#### 2. 在 `note-gen-sync` 仓库中设置 GitHub Secrets

你需要将上一步保存的私钥（或 PAT）作为密钥添加到 `note-gen-sync` 仓库的 GitHub Secrets 中。

*   进入 `note-gen-sync` 仓库。
*   点击 **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**。
*   **对于 Deploy Key：**
    *   **Name:** `DEPLOY_KEY_PRIVATE` (或者其他你容易记的名字)
    *   **Secret:** 粘贴你保存的私钥 (`id_rsa` 文件的内容)
*   **对于 PAT：**
    *   **Name:** `GH_PAT_TOKEN` (或者其他你容易记的名字)
    *   **Secret:** 粘贴你保存的 PAT

#### 3. 在 `note-gen-sync` 仓库中编写 GitHub Actions 工作流

这个工作流将在 `note-gen-sync` 仓库的 `main` 分支有新的 push 时触发。

在 `note-gen-sync` 仓库根目录下创建 `.github/workflows/sync-notes.yml` 文件，并添加以下内容：

```yaml
name: Sync Notes to Docusaurus Repo

on:
  push:
    branches:
      - main # 当 note-gen-sync 仓库的 main 分支有新的提交时触发

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout note-gen-sync repository
        uses: actions/checkout@v4 # 检查 note-gen-sync 仓库的代码

      - name: Configure Git for Docusaurus repo
        run: |
          git config --global user.name "GitHub Actions"
          git config --global user.email "actions@github.com"
          # 设置 SSH 密钥，用于访问 lixxcn.github.io
          mkdir -p ~/.ssh
          echo "${{ secrets.DEPLOY_KEY_PRIVATE }}" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh-keyscan github.com >> ~/.ssh/known_hosts # 将 github.com 加入已知主机
        env:
          # 如果你使用 PAT，则不需要这个 env 变量，直接在 checkout 步骤中使用 PAT
          DEPLOY_KEY_PRIVATE: ${{ secrets.DEPLOY_KEY_PRIVATE }}

      - name: Clone lixxcn.github.io repository
        run: |
          # 克隆 Docusaurus 仓库到临时目录
          # 使用 SSH URL，因为我们配置了 SSH 私钥
          git clone git@github.com:lixxcn/lixxcn.github.io.git docusaurus-repo-temp
          cd docusaurus-repo-temp
          git checkout main # 确保在正确的分支上操作
          cd ..

      - name: Copy notes to Docusaurus docs directory
        run: |
          # 假设你的笔记在 note-gen-sync 仓库的 `notes` 目录下
          # 并且你希望同步到 lixxcn.github.io 仓库的 `docs` 目录下
          # 清空目标目录（可选，但推荐，确保旧文件被移除）
          rm -rf docusaurus-repo-temp/docs/*
          # 复制所有 .md 文件
          cp -r notes/* docusaurus-repo-temp/docs/
          # 如果你的笔记包含图片或其他资源，并且它们也在 notes 目录下，确保也复制过去
          # cp -r notes/assets docusaurus-repo-temp/docs/assets # 如果有这样的结构

      - name: Commit and push changes to lixxcn.github.io
        run: |
          cd docusaurus-repo-temp
          git add .
          git diff-index --quiet HEAD || git commit -m "chore: Sync notes from note-gen-sync [skip ci]" # 检查是否有更改才提交
          git push
        env:
          # 如果你使用 PAT，则将此步骤的 Git URL 改为 HTTPS，并使用 PAT 作为密码
          # 例如：git push https://lixxcn:${{ secrets.GH_PAT_TOKEN }}@github.com/lixxcn/lixxcn.github.io.git
          # 这种情况下，configure Git 步骤的 SSH config 部分可以省略。
          SSH_AUTH_SOCK: /tmp/ssh_agent.sock # 确保 SSH Agent 可用
```

#### 代码解释和注意事项：

*   **`on: push: branches: - main`**: 当 `note-gen-sync` 仓库的 `main` 分支发生 `push` 事件时，工作流会被触发。
*   **`Configure Git for Docusaurus repo`**:
    *   配置 Git 用户信息，这样提交记录会显示 `GitHub Actions`。
    *   将 `DEPLOY_KEY_PRIVATE` secret 的内容写入 `~/.ssh/id_rsa`，这是 SSH 密钥文件的标准位置。
    *   `chmod 600 ~/.ssh/id_rsa` 是设置私钥文件的正确权限，否则 SSH 会拒绝使用。
    *   `ssh-keyscan github.com >> ~/.ssh/known_hosts` 是将 GitHub 的主机指纹添加到 `known_hosts`，防止首次连接时的安全提示。
*   **`Clone lixxcn.github.io repository`**: 使用 `git clone git@github.com:lixxcn/lixxcn.github.io.git docusaurus-repo-temp` 通过 SSH 协议拉取 Docusaurus 仓库到名为 `docusaurus-repo-temp` 的临时目录。
*   **`Copy notes to Docusaurus docs directory`**:
    *   `notes/*` 假设你的笔记在 `note-gen-sync` 仓库的 `notes` 目录下。请根据你实际的目录结构调整。
    *   `docusaurus-repo-temp/docs/` 是 Docusaurus 仓库中存放文档的目录。请根据你的 Docusaurus 配置确认。
    *   `rm -rf docusaurus-repo-temp/docs/*`：强烈建议在复制新文件前清空目标目录，以避免旧文件残留。如果你的 `docs` 目录下还有 Docusaurus 自己的文件（如 `_category_.json` 等），需要更精确的清理，或者只删除 `.md` 文件。例如： `find docusaurus-repo-temp/docs/ -name "*.md" -delete`
*   **`Commit and push changes to lixxcn.github.io`**:
    *   进入 Docusaurus 临时仓库目录。
    *   `git add .` 添加所有更改。
    *   `git diff-index --quiet HEAD || git commit -m "chore: Sync notes from note-gen-sync [skip ci]"` 检查是否有实际更改，如果有才提交。`[skip ci]` 标签是为了防止无限循环构建：当你推送到 `lixxcn.github.io` 时，它也会触发 Docusaurus 仓库的构建，Docusaurus 仓库收到新的更新后，如果也触发了 `note-gen-sync` 的同步，就会陷入死循环。`[skip ci]` 告诉 GitHub Actions 跳过此提交的 CI 流程。
    *   `git push` 将更改推送到 `lixxcn.github.io` 仓库。

## 总结与建议

强烈建议你采用**方案一**：在 `note-gen-sync` 仓库中配置 GitHub Actions，将笔记推送到 `lixxcn.github.io` 仓库。

**原因如下：**

*   **解耦性好：** 笔记生成和同步逻辑都在 `note-gen-sync` 仓库，Docusaurus 仓库只负责展示。
*   **触发机制清晰：** 只有笔记有更新时才进行同步，不影响 Docusaurus 仓库的其他操作。
*   **避免循环：** `[skip ci]` 标签有效防止了无限循环触发。
*   **权限管理：** 使用 Deploy Key 可以限制权限在特定的仓库，安全性高于 PAT。

**操作步骤总结：**

1.  **在 `lixxcn.github.io` 仓库生成一个带写入权限的 Deploy Key。**
2.  **在 `note-gen-sync` 仓库的 Secrets 中，添加这个 Deploy Key 的私钥。**
3.  **在 `note-gen-sync` 仓库的 `.github/workflows/` 目录下创建 `sync-notes.yml` 文件，并粘贴上面提供的 YAML 代码。**

配置完成后，当你向 `note-gen-sync` 仓库的 `main` 分支提交任何更改时，GitHub Actions 都会自动帮你同步笔记到 `lixxcn.github.io` 的 `docs` 目录下，并触发 Docusaurus 的构建。