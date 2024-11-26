import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ThemeIcon } from "vscode";
import { ISnipp, IGroup } from "../models/SnippItem";
/**
 * 依托TreeDataProvider，
 * TreeDataProvider 提供节点依赖项数据，需要实现两个方法
 * getChildren(element?: T): ProviderResult<T[]> 返回给定参数的子项目
 * getTreeItem(element: T): TreeItem | Thenable<TreeItem> 返回在视图中显示的元素
 * 当注册后会先触发getTreeItem，然后会触发getChildren
 * 注册通过window.registerTreeDataProvider进行注册
 * onDidChangeTreeData属于更新
 */
export class SnippDataProvider
  implements vscode.TreeDataProvider<any>, vscode.TextDocumentContentProvider
{
  private _onDidChangeTreeData: vscode.EventEmitter<any> =
    new vscode.EventEmitter<any>();
  readonly onDidChangeTreeData: vscode.Event<any> =
    this._onDidChangeTreeData.event;
  constructor(
    private readonly model: any,
    private context: vscode.ExtensionContext
  ) {}
  // 判断是否是代码片段
  public static isSnipp(object: any): object is IGroup {
    return ["Snippet", 14].includes(object.kind);
  }
  /**
   *
   * @param element
   * @returns TreeItem
   * label: 名称
   * id：唯一性标识
   * iconPath: 图标
   * description：描述
   * tooltip：鼠标放上的提示
   * collapsibleState：折叠状态
   */
  public getTreeItem(element: ISnipp | IGroup): vscode.TreeItem {
    const isSnip = SnippDataProvider.isSnipp(element);
    const snippcomm = {
      command: "extension.aiccCli.insertEntry",
      title: "",
      arguments: [element]
    };
    let snippetInfo: string = isSnip
      ? `[${element.scope}] ${element.label}`
      : `[${element.name}]`;
    const treeItem: vscode.TreeItem = new vscode.TreeItem(
      isSnip ? element.label : element.name,
      !isSnip
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    treeItem.contextValue  = isSnip ? "file" : "folder";
    treeItem.iconPath = isSnip ? new ThemeIcon("code") : new ThemeIcon("folder")
    treeItem.command =  isSnip ? snippcomm : undefined; //触发那个命令
    treeItem.tooltip = isSnip
        ? new vscode.MarkdownString(
            `**标题：**${snippetInfo}\n\n补全快捷键：${element.prefix}\n\n描述：${element.description}\n\n**预览：**\n\`\`\`${element.scope}\n${element.insertText.value}\n\`\`\``
          )
        : undefined;
    // const treeItem: any = {
    //   label: isSnip ? element.label : element.name,
    //   command: isSnip ? snippcomm : undefined, //触发那个命令
    //   iconPath: isSnip ? new ThemeIcon("code") : new ThemeIcon("folder"),
    //   contextValue: isSnip ? "file" : "folder",
    //   tooltip: isSnip
    //     ? new vscode.MarkdownString(
    //         `**标题：**${snippetInfo}\n\n补全快捷键：${element.prefix}\n\n描述：${element.description}\n\n**预览：**\n\`\`\`${element.scope}\n${element.insertText.value}\n\`\`\``
    //       )
    //     : undefined,
    //   collapsibleState: !isSnip
    //     ? vscode.TreeItemCollapsibleState.Collapsed
    //     : undefined
    // };
    return treeItem;
  }

  public getChildren(
    element?: ISnipp | IGroup
  ): ISnipp[] | Thenable<ISnipp[]> | IGroup[] | Thenable<IGroup[]> {
    return element ? this.model.getChildren(element) : this.model.roots;
  }
  public refresh(): any {
    this._onDidChangeTreeData.fire(null);
  }
  public provideTextDocumentContent(
    uri: vscode.Uri,
    token?: vscode.CancellationToken
  ): vscode.ProviderResult<string> {
    return this.model.getContent(uri).then((content: any) => {
      return content;
    });
  }
}
