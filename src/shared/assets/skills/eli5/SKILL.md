---
name: eli5
description: 「ELI5」「5歳の子にもわかるように」「explain like I'm 5」「親や家族に説明したい」「非エンジニアに伝えたい」「上司に伝えたい」「初心者向けにかみ砕いて」など、聞き手に合わせて概念・コード・エラー・資料を説明するときに使う。
---

# 聞き手に合わせて説明する

同じことを知りたい人でも、知っている言葉と、答えを聞いた後にしたいことは違う。質問からその二つを拾い、説明の入り口を決める。

1. **誰が、何を知りたいか。** 「小学生に」「設計を判断する人に」など、指定された相手に向けて書く。相手が実際に知っていることや質問の目的を、年齢・職業からの推測より優先する。子どもには楽しく、家族には普段の会話のように、仕事の相手には落ち着いて話し、誰に対しても見下す言い方を避ける。相手の指定がない「ELI5」は、5歳の子にも伝わる短い説明にする。
2. **説明の芯を確かめる。** 資料の主張、コードの目的と動き、エラーから読み取れることを押さえる。原因がいくつも考えられるエラーなら、表示から分かる範囲を示す。専門外の人には細部を思い切って省いてよい。例えや省略を入れても、元の因果関係を保つ。
3. **相手が使える一文から始める。** 初めて聞く人には「何をするものか」を短く伝え、身近な場面と結びつける。例のどの部分が実物の何に当たるかが伝わったら、本題に戻る。必要な専門語には、その場で意味を添える。
4. **聞き手の目的に応じて深さと長さを変える。** 管理者には仕事への影響や必要な判断を先に示し、数値には資料にある値を使う。仕組みを知りたい技術者には正確な用語で処理の流れや設計上の得失を伝える。最初の質問に聞き手の言葉で答えたら、その人にとってなぜ大事か（何が変わるか、何を決められるか）を一言添えて終える。

付属資料がある場合は、[聞き手別の例](references/audiences.md) で、同じ題材を子ども・店長・学生にどう伝え分けるかを参照できる。

出典は [DreambigOu/ELI5 の原版](https://github.com/DreambigOu/ELI5/tree/a766623b062331fdde53467001379b4ddf3acc2f/skills/eli5)。本スキルはその日本語での翻案。

<!--
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
-->
