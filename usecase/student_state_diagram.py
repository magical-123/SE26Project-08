import os
os.environ["PATH"] += os.pathsep + r"C:\Program Files\Graphviz\bin"

from graphviz import Digraph

dot = Digraph(name='StudentStateDiagram', format='png')
dot.attr(
    rankdir='TB',
    size='10,14', dpi='300',
    fontname='SimHei',
    label='大学生（Student）状态图',
    labelloc='t', fontsize='20',
    pad='0.5', nodesep='0.6', ranksep='0.8',
    bgcolor='white'
)
dot.attr('node', fontname='SimHei', fontsize='10')
dot.attr('edge', fontname='SimHei', fontsize='9')

# ============================================================
# 初始 & 终止状态
# ============================================================
dot.node('init', '', shape='circle', style='filled', fillcolor='black', width='0.2', height='0.2')
dot.node('final', '', shape='doublecircle', style='filled', fillcolor='black', width='0.3', height='0.3')

# ============================================================
# 顶层状态（不在 cluster 内）
# ============================================================
dot.node('admitted', '高考录取', shape='box', style='rounded', fillcolor='#FFF3E0')
dot.node('vacation', '假期', shape='box', style='rounded', fillcolor='#F3E5F5')
dot.node('suspended', '休学', shape='box', style='rounded', fillcolor='#FFF3E0')
dot.node('dropout', '退学', shape='box', style='rounded', fillcolor='#FFCDD2')
dot.node('graduated', '毕业', shape='box', style='rounded', fillcolor='#C8E6C9')

# ============================================================
# 在读 复合状态 — 子状态放在 cluster 内
# ============================================================
with dot.subgraph(name='cluster_studying') as sg:
    sg.attr(
        label='在读',
        style='rounded,dashed',
        color='#1976D2',
        fontcolor='#1976D2',
        fontsize='14',
        fontname='SimHei',
        margin='15'
    )
    sg.node('_freshman', '大一', shape='box', style='rounded', fillcolor='#E3F2FD')
    sg.node('_sophomore', '大二', shape='box', style='rounded', fillcolor='#E3F2FD')
    sg.node('_junior', '大三', shape='box', style='rounded', fillcolor='#E3F2FD')
    sg.node('_senior', '大四', shape='box', style='rounded', fillcolor='#E3F2FD')

    # 仅保留内部转换
    sg.edge('_freshman', '_sophomore', label='升入大二', fontname='SimHei', fontsize='9')
    sg.edge('_sophomore', '_junior', label='升入大三', fontname='SimHei', fontsize='9')
    sg.edge('_junior', '_senior', label='升入大四', fontname='SimHei', fontsize='9')

# ============================================================
# 跨边界转换（全部放在主图中，使用 xlabel 避免文字冲突）
# ============================================================

# 入学流程
dot.edge('init', 'admitted', label='', fontname='SimHei', fontsize='9')
dot.edge('admitted', '_freshman', label='入学', fontname='SimHei', fontsize='9')

# 年级 → 假期
dot.edge('_freshman', 'vacation', xlabel='学年结束', fontname='SimHei', fontsize='9', style='dashed', color='#9C27B0')
dot.edge('_sophomore', 'vacation', xlabel='学年结束', fontname='SimHei', fontsize='9', style='dashed', color='#9C27B0')
dot.edge('_junior', 'vacation', xlabel='学年结束', fontname='SimHei', fontsize='9', style='dashed', color='#9C27B0')

# 假期 → 年级
dot.edge('vacation', '_sophomore', xlabel='升入大二', fontname='SimHei', fontsize='9', style='dashed', color='#9C27B0')
dot.edge('vacation', '_junior', xlabel='升入大三', fontname='SimHei', fontsize='9', style='dashed', color='#9C27B0')
dot.edge('vacation', '_senior', xlabel='升入大四', fontname='SimHei', fontsize='9', style='dashed', color='#9C27B0')

# 毕业
dot.edge('_senior', 'graduated', label='修满40学分', fontname='SimHei', fontsize='9')

# 年级 → 休学
dot.edge('_freshman', 'suspended', xlabel='创业/生病', fontname='SimHei', fontsize='9', style='dashed', color='#FF9800')
dot.edge('_sophomore', 'suspended', xlabel='创业/生病', fontname='SimHei', fontsize='9', style='dashed', color='#FF9800')
dot.edge('_junior', 'suspended', xlabel='创业/生病', fontname='SimHei', fontsize='9', style='dashed', color='#FF9800')
dot.edge('_senior', 'suspended', xlabel='创业/生病', fontname='SimHei', fontsize='9', style='dashed', color='#FF9800')

# 休学 → 年级（复学）
dot.edge('suspended', '_freshman', xlabel='复学', fontname='SimHei', fontsize='9', style='dashed', color='#FF9800')
dot.edge('suspended', '_sophomore', xlabel='复学', fontname='SimHei', fontsize='9', style='dashed', color='#FF9800')
dot.edge('suspended', '_junior', xlabel='复学', fontname='SimHei', fontsize='9', style='dashed', color='#FF9800')
dot.edge('suspended', '_senior', xlabel='复学', fontname='SimHei', fontsize='9', style='dashed', color='#FF9800')

# 年级 → 退学
dot.edge('_freshman', 'dropout', xlabel='退学', fontname='SimHei', fontsize='9', style='dashed', color='#E53935')
dot.edge('_sophomore', 'dropout', xlabel='退学', fontname='SimHei', fontsize='9', style='dashed', color='#E53935')
dot.edge('_junior', 'dropout', xlabel='退学', fontname='SimHei', fontsize='9', style='dashed', color='#E53935')
dot.edge('_senior', 'dropout', xlabel='退学', fontname='SimHei', fontsize='9', style='dashed', color='#E53935')

# 终止
dot.edge('dropout', 'final', label='', fontname='SimHei', fontsize='9')
dot.edge('graduated', 'final', label='', fontname='SimHei', fontsize='9')

# ============================================================
# 图例
# ============================================================
legend = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="3" CELLPADDING="4">
<TR><TD COLSPAN="2" BGCOLOR="#EEEEEE"><B><FONT POINT-SIZE="10">图例</FONT></B></TD></TR>
<TR><TD BGCOLOR="#E3F2FD" WIDTH="18"></TD><TD ALIGN="LEFT"><FONT POINT-SIZE="9">在读（复合状态）</FONT></TD></TR>
<TR><TD BGCOLOR="#FFF3E0" WIDTH="18"></TD><TD ALIGN="LEFT"><FONT POINT-SIZE="9">录取 / 休学</FONT></TD></TR>
<TR><TD BGCOLOR="#F3E5F5" WIDTH="18"></TD><TD ALIGN="LEFT"><FONT POINT-SIZE="9">假期</FONT></TD></TR>
<TR><TD BGCOLOR="#C8E6C9" WIDTH="18"></TD><TD ALIGN="LEFT"><FONT POINT-SIZE="9">毕业</FONT></TD></TR>
<TR><TD BGCOLOR="#FFCDD2" WIDTH="18"></TD><TD ALIGN="LEFT"><FONT POINT-SIZE="9">退学</FONT></TD></TR>
<TR><TD COLSPAN="2"><TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="0"><TR><TD COLSPAN="2" BGCOLOR="#CCCCCC" HEIGHT="1"></TD></TR></TABLE></TD></TR>
<TR><TD COLSPAN="2" ALIGN="LEFT"><FONT POINT-SIZE="8">── 实线: 正常流转</FONT></TD></TR>
<TR><TD COLSPAN="2" ALIGN="LEFT"><FONT POINT-SIZE="8">- - - 虚线: 异常/可选流转</FONT></TD></TR>
<TR><TD COLSPAN="2" ALIGN="LEFT"><FONT POINT-SIZE="8">● 初始  ◎ 终止</FONT></TD></TR>
</TABLE>>'''

dot.node('legend', legend, shape='plaintext')

# ============================================================
# 渲染
# ============================================================
output = 'Student_StateDiagram'
dot.render(output, view=True, cleanup=True)
print(f"已生成：{output}.png")