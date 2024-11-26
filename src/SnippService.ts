import {
  ExtensionContext,
  commands,
  window,
  languages,
  TextDocument,
  Position,
  CancellationToken,
  CompletionContext,
  CompletionItem,
  ViewColumn,
  workspace,
  env,
  SnippetString,
  Range,
  Uri
} from "vscode";
import * as fs from "fs";
import { ISnipp } from "./models/SnippItem";
import { SnippDataProvider } from "./providers/SnippDataProvider";
import path = require("path");

export async function AddSnipp(
  context: ExtensionContext,
  name: string,
  type?: string,
  jsonData?: any,
  callBack?: Function
) {
  let jsonContent, targetPath;
  if (jsonData) {
    targetPath = Uri.file(
      `${context.globalState.get("snippetsFolderPath")}/${name}`
    );
    jsonContent = jsonData;
  } else {
    const content = await getSnippText();
    const trimmedName = content?.text?.trim().substring(0, 20) || "";
    // 指定生成文件的地址

    targetPath = Uri.file(
      `${context.globalState.get("snippetsFolderPath")}/${name}.code-snippets`
    );
    let strArr: any[] = [];
    // content.text?.split('\r\n')
    jsonContent = {
      "": {
        scope: type ? type : "",
        prefix: "",
        body: strArr.concat(content?.text?.trim().split("\r\n") || []),
        description: ""
      }
    };
  }

  // 检查路径是否存在，如果不存在则创建对应的文件夹
  const dir = path.dirname(targetPath.fsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 写入文件
  writeFileWithJsonContent(
    targetPath.fsPath,
    jsonContent,
    jsonData ? true : false,
    callBack
  );
  // await _addOrUpdateSnipp(context, { ...state, name: trimmedName }, content);
}
/**
 * 向编译器写入代码片段
 * @param context
 * @param snipp
 */
export async function InsertSnipp(context: ExtensionContext, snipp: ISnipp) {
  // 获取当前所在的编辑器
  const editor = window.activeTextEditor;
  if (editor && SnippDataProvider.isSnipp(snipp)) {
    // 判断文件类型是不是代码片段所需要的
    let selection = editor.selection;
    let { start, end } = selection;
    // const position = editor?.selection.active;
    //如果是选中的话应该是覆盖，而不是单纯的插入
    // const replacedContentText = await ReplacePlaceholders(snipp.insertText.value, context);
    //  // 在编辑器
    //   editor.edit(async (edit) => {
    //     edit.insert(position, replacedContentText || '');
    //   });
    let content = snipp?.insertText?.value || snipp.content;
    let Thenable = editor.insertSnippet(
      new SnippetString(content),
      new Range(start, end)
    );
  } else if (editor && !SnippDataProvider.isSnipp(snipp)) {
    window.showErrorMessage(`请选择一个代码片段`);
  } else if (!editor) {
    window.showErrorMessage(`插入代码片段失败，请打开一个文件`);
  } else {
    window.showErrorMessage(`插入代码片段失败`);
  }
}
export async function AddSnippFromEditor(
  context: ExtensionContext,
  state: Partial<ISnipp>
) {
  const name = await window.showInputBox({
    prompt: "键入Snippet标题",
    value: state.name ?? ""
  });
  if (name) {
    const content = await showInputBoxWithMultiline(
      context,
      "请输入Snippet内容",
      `新建-${name}`,
      ""
    );
    if (content) {
      await _addOrUpdateSnipp(
        context,
        { ...state, name },
        { text: content, type: "TEXT" }
      );
    }
  }
}

export async function EditSnipp(
  context: ExtensionContext,
  state: Partial<ISnipp>,
  snippIndex: number
) {
  const content = await showInputBoxWithMultiline(
    context,
    "请输入Snippet内容",
    `编辑-${state.name}`,
    state.content ?? ""
  );
  if (content) {
    await _addOrUpdateSnipp(
      context,
      state,
      { text: content, type: state.contentType ?? "TEXT" },
      snippIndex
    );
  }
}

export async function EditSnippTitle(
  context: ExtensionContext,
  state: Partial<ISnipp>,
  snippIndex: number
) {
  const name = await window.showInputBox({
    prompt: "键入Snippet标题",
    value: state.name ?? ""
  });
  if (name) {
    await _addOrUpdateSnipp(context, { ...state, name }, undefined, snippIndex);
  }
}

async function _addOrUpdateSnipp(
  context: ExtensionContext,
  state: Partial<ISnipp>,
  content?: {
    text: string | undefined;
    type: string | undefined;
  },
  snippIndex?: number
) {
  if (content !== undefined) {
    state.content = content?.text;
    state.contentType = content?.type;
  }

  const existingSnipps = context.globalState.get("snipps", []);

  let updatedSnipps: Partial<ISnipp>[];
  if (snippIndex === undefined || snippIndex < 0) {
    updatedSnipps = [...existingSnipps, state];
  } else {
    updatedSnipps = existingSnipps.map((exsnip: ISnipp, index) => {
      if (index === snippIndex) {
        return state;
      } else {
        return exsnip;
      }
    });
  }
  context.globalState.update("snipps", updatedSnipps);
  const extensionContext = context;

  if (content?.type && state.name) {
    languages.registerCompletionItemProvider(content.type, {
      provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: CompletionContext
      ) {
        return new Promise<CompletionItem[]>((resolve, reject) => {
          ReplacePlaceholders(state.content || "", extensionContext).then(
            (res) => {
              const replacedContentText = res;
              const commandCompletion = new CompletionItem(state.name || "");
              commandCompletion.insertText = replacedContentText || "";
              resolve([commandCompletion]);
            }
          );
        });
      }
    });
  }

  window.showInformationMessage("Snippet保存成功");

  // commands.executeCommand("extension.snippetCraft.refreshEntry");
}

async function getSnippText() {
  const editor = window.activeTextEditor;

  let text = editor?.document.getText(editor.selection);
  return { text, type: editor?.document.languageId };
}

export async function SearchSnipp(context: ExtensionContext) {
  const snipps = context?.globalState?.get("snippets", []);
  const result = await window.showQuickPick(
    snipps.map((sn: ISnipp) => ({
      label: sn.label,
      description: sn.description,
      snipp: sn
    })),
    {
      placeHolder: "搜索Snippets",
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  if (result && result.snipp) {
    result.snipp.kind = 14;
    commands.executeCommand("extension.aiccCli.insertEntry", result.snipp);
  }
}

async function showInputBoxWithMultiline(
  context: ExtensionContext,
  placeholder: string,
  title: string,
  initialValue: string
): Promise<string | undefined> {
  const panel = window.createWebviewPanel(
    "multilineInput",
    title,
    ViewColumn.One,
    {
      enableScripts: true
    }
  );

  panel.webview.html = getWebviewContent(placeholder, initialValue);

  return new Promise<string | undefined>((resolve) => {
    panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "submit":
            resolve(message.text);
            panel.dispose();
            return;
          case "cancel":
            resolve(undefined);
            panel.dispose();
            return;
        }
      },
      undefined,
      context.subscriptions
    );
  });
}

function getWebviewContent(placeholder: string, initialValue: string): string {
  return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Multiline Input</title>
      </head>
      <body>
        <textarea id="inputBox" rows="10" cols="50" placeholder="${placeholder}">${initialValue}</textarea>
        <br>
        <button onclick="submitText()">提交</button>
        <button onclick="cancel()">取消</button>
        <script>
          const vscode = acquireVsCodeApi();
          function submitText() {
            const text = document.getElementById('inputBox').value;
            vscode.postMessage({ command: 'submit', text: text });
          }
          function cancel() {
            vscode.postMessage({ command: 'cancel' });
          }
        </script>
      </body>
      </html>
    `;
}
/**
 * 根据一些规则将一个占位符替换成其他的东西,根据内置的变量进行替换
 * @param text
 * @param context
 * @returns
 */
export async function ReplacePlaceholders(
  text: string,
  context: ExtensionContext
): Promise<string> {
  const editor = window.activeTextEditor;
  const clipboard = await env.clipboard.readText();
  const workspaceFolders = workspace.workspaceFolders;
  const currentDate = new Date();
  const kvObject = context.globalState.get<{ [key: string]: string }>(
    "key-value",
    {}
  );

  const replacements: { [key: string]: string } = {
    "${TM_SELECTED_TEXT}": editor?.document.getText(editor.selection) || "",
    "${TM_CURRENT_LINE}":
      editor?.document.lineAt(editor.selection.active.line).text || "",
    "${TM_CURRENT_WORD}":
      editor?.document.getText(
        editor.document.getWordRangeAtPosition(editor.selection.active)
      ) || "",
    "${TM_LINE_INDEX}": (editor?.selection.active.line ?? 0).toString(),
    "${TM_LINE_NUMBER}": ((editor?.selection.active.line ?? 0) + 1).toString(),
    "${TM_FILENAME}": editor ? path.basename(editor.document.fileName) : "",
    "${TM_FILENAME_BASE}": editor
      ? path.basename(
          editor.document.fileName,
          path.extname(editor.document.fileName)
        )
      : "",
    "${TM_DIRECTORY}": editor ? path.dirname(editor.document.fileName) : "",
    "${TM_FILEPATH}": editor?.document.fileName || "",
    "${RELATIVE_FILEPATH}":
      editor && workspaceFolders
        ? path.relative(
            workspaceFolders[0].uri.fsPath,
            editor.document.fileName
          )
        : "",
    "${CLIPBOARD}": clipboard,
    "${WORKSPACE_NAME}": workspaceFolders ? workspaceFolders[0].name : "",
    "${WORKSPACE_FOLDER}": workspaceFolders
      ? workspaceFolders[0].uri.fsPath
      : "",
    "${CURSOR_INDEX}": (editor?.selection.active.character ?? 0).toString(),
    "${CURSOR_NUMBER}": (
      (editor?.selection.active.character ?? 0) + 1
    ).toString(),
    "${CURRENT_YEAR}": currentDate.getFullYear().toString(),
    "${CURRENT_YEAR_SHORT}": currentDate.getFullYear().toString().slice(-2),
    "${CURRENT_MONTH}": (currentDate.getMonth() + 1)
      .toString()
      .padStart(2, "0"),
    "${CURRENT_MONTH_NAME}": currentDate.toLocaleString("default", {
      month: "long"
    }),
    "${CURRENT_MONTH_NAME_SHORT}": currentDate.toLocaleString("default", {
      month: "short"
    }),
    "${CURRENT_DATE}": currentDate.getDate().toString().padStart(2, "0"),
    "${CURRENT_DAY_NAME}": currentDate.toLocaleString("default", {
      weekday: "long"
    }),
    "${CURRENT_DAY_NAME_SHORT}": currentDate.toLocaleString("default", {
      weekday: "short"
    }),
    "${CURRENT_HOUR}": currentDate.getHours().toString().padStart(2, "0"),
    "${CURRENT_MINUTE}": currentDate.getMinutes().toString().padStart(2, "0"),
    "${CURRENT_SECOND}": currentDate.getSeconds().toString().padStart(2, "0"),
    "${CURRENT_SECONDS_UNIX}": Math.floor(
      currentDate.getTime() / 1000
    ).toString(),
    "${CURRENT_TIMEZONE_OFFSET}": formatTimezoneOffset(
      currentDate.getTimezoneOffset()
    ),
    "${RANDOM}": Math.random().toString().slice(2, 8),
    "${RANDOM_HEX}": Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0"),
    "${UUID}": generateUUID()
  };

  Object.keys(kvObject).forEach((key) => {
    replacements[`$\{${key}\}`] = kvObject[key];
  });

  return text.replace(/\$\{(\w+)\}/g, (match, key) => {
    return replacements[match] || match;
  });
}

function formatTimezoneOffset(offset: number): string {
  const sign = offset > 0 ? "-" : "+";
  const absOffset = Math.abs(offset);
  const hours = Math.floor(absOffset / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (absOffset % 60).toString().padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function generateUUID(): string {
  const crypto = require("crypto");
  return crypto.randomUUID();
}
function writeFileWithJsonContent(
  filepath: string,
  jsonContent: any,
  noTips?: boolean,
  callBack?: Function
) {
  const content = JSON.stringify(jsonContent, null, 2);
  fs.writeFile(filepath, content, (err) => {
    if (noTips) {
      if (err) {
        // 文件写入出错
        window.showErrorMessage(`同步失败: ${err.message}`);
      }
      callBack && callBack();
    } else {
      if (err) {
        // 文件写入出错
        window.showErrorMessage(`代码片段文件写入失败: ${err.message}`);
      } else {
        window.showInformationMessage(
          "File created and JSON written successfully."
        );
        const uri = Uri.file(filepath);
        commands.executeCommand("vscode.open", uri);
        window.showInformationMessage("代码片段保存成功");
      }
    }
  });
}
