# 数据许可 / Data licensing (`data/`)

## 1. 结构化字段与中文摘要：CC BY 4.0

`id`、`name`、`nameEn`、`year`、`year_basis`、`year_note`、`era`、`category`、`kind`、
`importance`、`status`、`desc`、`prereqs`、`related` 全部为本项目独立编排与撰写的成果：
选择哪些条目、定在哪一年、归入哪个领域、依赖谁，以及每条一句话的 `desc` 中文说明。

以 **CC BY 4.0** 发布：

> You are free to Share and Adapt, in any medium or format, for any purpose,
> even commercial, provided you give appropriate credit, link to the licence,
> and indicate if changes were made.
> <https://creativecommons.org/licenses/by/4.0/>

署名建议：`Set Theory Tech Tree (github.com/Infinilux/set-theory-tree), CC BY 4.0`。

## 2. 与上游项目的关系

本项目的数据是**重新编排**的集合论主题数据（1485 条），与上游
[secwind7/polytech-tree](https://github.com/secwind7/polytech-tree) 的人类科技树数据
（3876 条）**不共用任何条目**，字段结构也不同（本项目无 `wikiEn` / `aliases` / `year_span`）。

`desc` 为本项目自行撰写的中文摘要，未逐字复制维基百科文本。若个别表述与维基百科导语巧合雷同，
请以 CC BY-SA 4.0 的署名方式处理并来信告知，我们会调整措辞。

## 3. 事实本身的地位

年代、人名、定理的归属是事实与编排判断；本文件不主张对事实本身的专有权利，许可只覆盖本仓库的
表达形式。集合论史上有不少成果的「首次提出」与「正式发表」相隔多年（Easton 1964/1970、
Martin–Steel 1985/1989、Scott 1961/1967），本项目把这类情况**拆成两个独立条目**而非二选一，
具体取值见每条的 `year_basis` 与 `year_note`。