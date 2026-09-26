# G. 序号样式渲染（纯函数） — dev

| ID | 操作 | 预期 | 状态 |
|----|------|------|------|
| G1 | cjk：1/10/11/20/105/110/1024/10000/10005 | 一/十/十一/二十/一百零五/一百一十/一千零二十四/一万/一万零五 | ✅ |
| G2 | circled：1/20/21/35/36/50 | ①/⑳/㉑/㉟/㊱/㊿ | ✅ |
| G3 | circled 超界：51 | 回退 `(51)` | ✅ |
| G4 | lower-alpha：1/26/27/52/53 | a/z/aa/az/ba | ✅ |
| G5 | upper-alpha：同上大写 | A/Z/AA/… | ✅ |
| G6 | 混合样式 H2=cjk/H3=arabic/H4=circled，`ancestorNumeral=self` | `一` / `一.1` / `一.1.①` | ✅ |
| G7 | 同上 `ancestorNumeral=arabic` | `一` / `1.1` / `1.1.①` | ✅ |
| **G8** | lower-roman：1/4/5/9/10/14/40/44/50/90/100/400/500/900/1000/1994/2024 | i/iv/v/ix/x/xiv/xl/xliv/l/xc/c/cd/d/cm/m/mcmxciv/mmxxiv | ✅（0.6.3 `toRoman`）|
| **G9** | upper-roman：1/4/14/1994/2024 | I/IV/XIV/MCMXCIV/MMXXIV | ✅（0.6.3）|
