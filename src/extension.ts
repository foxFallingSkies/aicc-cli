import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import os from "node:os";
import { v4 as uuidv4 } from "uuid";
import {
  ExtensionContext,
  commands,
  workspace,
  window,
  OpenDialogOptions,
  Uri,
  languages,
  TextDocument,
  Position,
  CancellationToken,
  CompletionContext,
  CompletionItem
} from "vscode";
import {
  AddSnipp,
  EditSnipp,
  InsertSnipp,
  SearchSnipp,
  ReplacePlaceholders,
  EditSnippTitle,
  AddSnippFromEditor
} from "./SnippService";
import { parse } from "comment-json";
import { SnippItem, ISnipp } from "./models/SnippItem";
import { SnippDataProvider } from "./providers/SnippDataProvider";
let snippViewer:vscode.TreeView<any>;
/**
 * 插件激活后，执行，激活时执行一次
 * @param context
 */
export async function activate(context: vscode.ExtensionContext) {
  // todo 将平台的代码片段初始化，后面分内置和用户自定义
  //   // 初始化时设置值
  //   // 从全局数据中取snippets字段，，如果没有，则将初始化数据写入
  //   const snippetsObject = context.globalState.get("snippets");
  //   console.log(context.globalState);
  // //   if (!snippetsObject) {
  //     context.globalState.update("snippets", initialSnippets);
  // //   }
  initialSnippets(context);

  // 注册command
  /**
   * 插入代码片段
   */
  commands.registerCommand(
    "extension.aiccCli.insertEntry",
    async (snip: ISnipp) => {
      await InsertSnipp(context, snip);
    }
  );
  /**
   * 编辑代码片段
   * 如果是文件夹，直接编辑，如果是代码片段，直接打开文件进行编辑代码片段
   */
  commands.registerCommand("extension.aiccCli.edit", async (snip: ISnipp) => {
    // 如果是代码片段，直接打开文件，如果是分组，后面要将编辑按钮去掉
    if (snip.insertText) {
      const snippetDirMap: any = context.globalState.get("snippetDirMap");
      let filePath = snippetDirMap[snip.id];
      // 打开指定的文件
      workspace.openTextDocument(filePath).then((document) => {
        vscode.window.showTextDocument(document);
      });
    } else {
    }
  });
  commands.registerCommand("extension.aiccCli.addEntry", async () => {
  });
  commands.registerCommand("extension.aiccCli.createSnippets", async () => {
    const name = await window.showInputBox({
      prompt: "请输入代码片段文件名",
      value: ""
    });
    if (name) {
      await AddSnipp(context, name);
    }
  });
  commands.registerCommand("extension.aiccCli.refreshSnippets", async () => {
    initialSnippets(context);
  });
  commands.registerCommand("extension.aiccCli.deleteSnippets", async (snip) => {
    // 删除需要进行二次确定
    let confirmRes = await window.showInformationMessage(
      "确定删除该代码片段吗？",
      "确定",
      "取消"
    );
    if (confirmRes === "确定") {
      // 删除制定地址文件
      const snippetDirMap: any = context.globalState.get("snippetDirMap");
      let filePath = snippetDirMap[snip.id];
      fs.unlink(filePath, (err) => {
        if (err) throw err;
        window.showInformationMessage("代码片段删除成功");
        initialSnippets(context);
      });
    }
  });
  commands.registerCommand("extension.aiccCli.searchSnippets", async () => {
    await SearchSnipp(context);
  });
  commands.registerCommand("extension.aiccCli.downLoadSnippets", async () => {
    const folderPath = path.join(context.extensionPath, "snippets");
    const files = fs.readdirSync(folderPath);
    let count = 0;
    // 先将内置文件写入
    files.forEach((jsonFile) => {
      const filePath = path.join(folderPath, jsonFile);
      const jsonData = fs.readFileSync(filePath, "utf8");
      const jsonObject = JSON.parse(jsonData);
      AddSnipp(context, jsonFile,'', jsonObject, () => {
        count++;
        if (count === files.length) {
          initialSnippets(context);
        }
      });
    });
  });
  commands.registerCommand("extension.aiccCli.addSnippets", async () => {
    // 判断当前选中的是那个文件夹
    const selectNode = snippViewer.selection[0];
    if(!selectNode) {
      window.showErrorMessage("请先在左侧树形目录中选择文件夹");
      return;
    }
    let { contentType } = selectNode;
    const name = await window.showInputBox({
      prompt: "请输入代码片段文件名",
      value: ""
    });
    if (name) {
      await AddSnipp(context, name,contentType);
    }
  });
  //   const snipps = context?.globalState.get('snipps',[]);
  //   const contentTypes = snipps.map((snipp: ISnipp) => snipp.detail);
  //   const extensionContext = context;
  //   const providers = contentTypes
  //   .filter((value, index, self) => self.indexOf(value) === index)
  //   .map((type) =>
  // 	languages.registerCompletionItemProvider(type, {
  // 	  provideCompletionItems(
  // 		document: TextDocument,
  // 		position: Position,
  // 		token: CancellationToken,
  // 		context: CompletionContext
  // 	  ) {
  // 		return new Promise<CompletionItem[]>((resolve, reject) => {
  // 		  var result = snipps
  // 			.filter((snipp: ISnipp) => {
  // 			  return snipp.detail === type;
  // 			})
  // 			.map(async (snipp: ISnipp) => {
  // 			  const replacedContentText = await ReplacePlaceholders(
  // 				snipp.insertText.value,
  // 				extensionContext
  // 			  );

  // 			  const commandCompletion = new CompletionItem(snipp.label);
  // 			  commandCompletion.insertText = replacedContentText || "";
  // 			  return commandCompletion;
  // 			});

  // 		  Promise.all(result).then(resolve);
  // 		});
  // 	  }
  // 	})
  //   );

  // context.subscriptions.push(...providers);
  // 注册窗口保存事件监听器
  context.subscriptions.push(
    workspace.onDidSaveTextDocument((document: TextDocument) => {
      // 判断是否是代码片段
      const fileName = document.fileName;
      const snippetsFolderPath: string =
        context.globalState.get("snippetsFolderPath") || "";
      if (
        document.uri.fsPath
          .toLocaleLowerCase()
          .includes(snippetsFolderPath.toLocaleLowerCase())
      ) {
        // 说明是同一个文件夹，那么就说明是一个代码片段的报错，所以触发更新
        initialSnippets(context);
      }
    })
  );
  // 注册标签页关闭事件监听
  context.subscriptions.push(
    window.onDidChangeActiveTextEditor(
      (editor: vscode.TextEditor | undefined) => {
        // 关闭todo
      }
    )
  );
}
/**
 * 初始化代码片段
 * @param context
 */
async function initialSnippets(context: vscode.ExtensionContext) {
  let settingsJsonContent = await getSettingsJsonContent();
  //   const snippetDirMap = context.globalState.get("snippetDirMap");
  let snippetDirMap: any = {}; // 文件对应的映射
  //不用取配置了。走os.homedir()就行
  let dir = JSON.parse(settingsJsonContent)?.snippet?.user?.dir;

  const snippets: vscode.CompletionItem[] = [];
  if (dir) {
    // 获取用户主目录
    const homeDirectory = os.homedir();
    const snippetsFolderPath = path.join(dir, "Code", "User", "snippets");

    context.globalState.update("snippetsFolderPath", snippetsFolderPath);

    if (fs.existsSync(snippetsFolderPath)) {
      const snippetFiles = fs.readdirSync(snippetsFolderPath);
      snippetFiles.forEach((snippetFile) => {
        const filePath = path.join(snippetsFolderPath, snippetFile);
        const content = fs.readFileSync(filePath, "utf8");
        try {
          // 将每个文件进行切割
          const snippetsObj: any = parse(content);
          Object.keys(snippetsObj).forEach((key) => {
            const snippet = snippetsObj[key];
            snippet.scope =
              (snippet.scope &&
              (snippet.scope.includes("javascript") ||
                snippet.scope.includes("typescript"))
                ? "javascript"
                : snippet.scope) || "other";
            snippet.kind = 14;
            snippet.label = key;
            snippet.insertText = new vscode.SnippetString(
              snippet.body.join("\n")
            );
            const uuid = uuidv4();
            snippet.id = uuid;
            snippets.push(snippet);
            snippetDirMap[uuid] = filePath;
            // const completionItem = new vscode.CompletionItem(
            //   key,
            //   vscode.CompletionItemKind.Snippet
            // );
            // completionItem.insertText = new vscode.SnippetString(
            //   snippet.body.join("\n")
            // );
            // completionItem.commitCharacters = snippet.prefix;
            // completionItem.detail =
            //   (snippet.scope &&
            //   (snippet.scope.includes("javascript") ||
            //     snippet.scope.includes("typescript"))
            //     ? "js"
            //     : snippet.scope) || "other";
            // completionItem.documentation = snippet.description;
            // snippets.push(completionItem);
            // const uuid =  uuidv4();
            // debugger;
            // (completionItem as any).id =  uuid
            // snippetDirMap[key] = filePath;
          });
        } catch (error) {}
      });
    }
  }
  console.log(snippets);
  //将当前本地有个的代码片段数组写入到一个snipps数据中
  //context.globalState为一个全局的数据
  context.globalState.update("snippets", snippets);
  context.globalState.update("snippetDirMap", snippetDirMap);
  // 创建一个代码片段的对象
  const snippModel = new SnippItem("recent", context);
  // 将已有的代码片段写入到provider中
  const snippDataProvider = new SnippDataProvider(snippModel, context);
  /**
   * 注册provider，参数是在package.json中views中配置的id。这样将会在id对应的视图中显示
   */
  snippViewer = vscode.window.createTreeView("view.aiccCli.snippetsView", {
    treeDataProvider: snippDataProvider
  });
}
/**
 * 获取个人vscode的setting.json
 * @returns
 */
async function getSettingsJsonContent(): Promise<string> {
  const configuration = vscode.workspace.getConfiguration();
  const rawSettings = configuration.inspect("");
  const settingsJsonContent = JSON.stringify(rawSettings?.globalValue, null, 2);
  return settingsJsonContent;
}
// This method is called when your extension is deactivated
export function deactivate() {}
