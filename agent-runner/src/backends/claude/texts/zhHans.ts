import type { Messages } from '../../../i18n.ts';
import type { ja } from './ja.ts';

export const zhHans: Messages<typeof ja> = {
  notFound: '需要设置 Claude。请在 AI 公会的“设置 → 后端 → Claude”中进行。',
  loginAtRun: '登录状态将在执行时确认',
  needsLogin: '要使用 Claude，请在浏览器中登录 Claude 账户。',
  needsLoginTerminal: '尚未登录 Claude。请在终端中运行 `claude auth login`，或设置环境变量 ANTHROPIC_API_KEY。',
  loginFailed: '无法登录 Claude。请检查浏览器后重试。',
  loginWindowFailed: '无法打开登录窗口（{reason}）',
  loginIncomplete: 'Claude 登录未完成。请在打开的窗口和浏览器中完成登录',
  loginLabel: '使用 Claude Code 登录',
  loginWaiting: '请在打开的窗口和浏览器中继续登录。完成后状态会自动更新。',
  maxTurnsLabel: '最大轮数',
  maxTurnsDescription: '一次回复中使用工具往返的次数上限',
  operationCheckLabel: '操作确认',
  operationCheckDescription:
    '在执行命令、打开网页或写入工作文件夹之外之前，用小模型（Haiku）确认是否符合请求，可疑时停止（不询问人类）',
  folderUnsupported: 'Claude 的文件操作无法限制检查后替换链接，因此不能在指定文件夹中执行',
  runFailed: '无法执行 Claude（{detail}）',
  hintAuth: 'Claude 认证失败。请在终端中运行 `claude` 登录，或设置环境变量 ANTHROPIC_API_KEY。',
  hintRateLimit: '由于 Claude 的使用上限、速率限制或拥堵，无法执行。请稍候再发送消息。',
  hintModelNotFound: '找不到指定的模型。请检查智能体设置中的模型名称。',
  hintDetail: '{hint}（{detail}）',
  failed: 'Claude 发生错误（{detail}）',
  interrupted: 'Claude 的执行中途结束（{detail}）',
  imageType: '不支持的图片格式: {type}',
  imageRead: '无法读取附件图片（{path}）',
  ruleWrite: '如果允许写入工作区之外，也请允许写入文件',
  ruleBash: '允许执行命令后，将无法阻止文件读写（包括工作区之外）和网络访问',
};
