import * as vscode from "vscode";

export interface ISnipp {
  [x: string]: any;
  created: Date;
  lastUsed: Date;
  kind: number;
  insertText: {
    value: string;
    [keyName: string]: any;
  };
  prefix: string;
  scope: string;
  description: string;
  label: string; // 名称
}

export interface IGroup {
  [x: string]: any;
  name: string;
  contentType: string | undefined;
}
export class SnippItem {
  constructor(
    readonly view: string,
    private context: vscode.ExtensionContext
  ) {}
  /**
   * 根据已有的数据进行代码片段，根据detail字段进行分类生成文件夹
   */
  public get roots(): Thenable<IGroup[]> {
    // 获取所有的代码片段的数据
    const snipps = this.context?.globalState?.get("snippets", []);
    const types = snipps
      .map((snipp: ISnipp) => snipp.scope)
      .filter((value, index, self) => self.indexOf(value) === index)
      .map((type) => {
        let obj = {
          name: type === "other" ? "其他" : type,
          contentType: type || "other"
        };
        return obj;
      });
    return Promise.resolve(types);
  }

  public getChildren(node: IGroup): Thenable<ISnipp[]> {
    const snipps = this.context?.globalState
      ?.get("snippets", [])
      .filter((snipp: ISnipp) => {
        let { scope } = snipp;
        let { contentType } = node;
        return scope === contentType;
      })
      .sort((a: ISnipp, b: ISnipp) => a.label.localeCompare(b.label));

    return Promise.resolve(snipps);
  }

  public getContent(resource: vscode.Uri): Thenable<string> {
    return Promise.resolve("");
  }
}

export class GroupItem {}
