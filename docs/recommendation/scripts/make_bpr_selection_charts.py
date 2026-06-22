"""
Tao 2 bieu do moi cho bao cao lua chon BPR-MF (chi tao file moi, khong sua file cu).

- bpr_selection_top10_metrics.png: Precision@10, NDCG@10, HitRate@10 cua 4 thuat toan.
- bpr_vs_baselines_precision_ndcg.png: Precision@10 vs NDCG@10.

Mac dinh giu nguyen style: clean, tieng Viet, khong mau qua loe loet.

Cach chay (tu project root D:/CaNhan/Luan_Van):
    python docs/recommendation/scripts/make_bpr_selection_charts.py

Script dung path tuong doi (CWD) nen phai chay tu project root.
"""

import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

CHARTS_DIR = os.path.join("datasets", "processed", "charts")
os.makedirs(CHARTS_DIR, exist_ok=True)

# Color palette (giong style bpr_mf_latest: BPR-MF toi dam de nhan biet)
COLOR_POPULAR = "#9aa0a6"   # xam
COLOR_CB = "#5b8def"         # xanh duong
COLOR_BPR = "#e0852c"        # cam dam (BPR-MF - thuat toan chinh)
COLOR_HYB = "#3aa986"        # xanh la

# Du lieu tu datasets/processed/recommendation_evaluation_results.csv
algos = ["Most Popular", "Content-Based Audio", "BPR-MF", "Hybrid Context-Aware"]
algo_short_vi = ["Most Popular", "Content-Based Audio", "BPR-MF", "Hybrid"]

precision_10 = [0.0273, 0.0428, 0.0985, 0.0649]
recall_10 = [0.0128, 0.0186, 0.0435, 0.0291]
ndcg_10 = [0.0284, 0.0470, 0.0978, 0.0687]
map_10 = [0.0094, 0.0180, 0.0365, 0.0279]
hitrate_10 = [0.2371, 0.3144, 0.6340, 0.4124]

colors = [COLOR_POPULAR, COLOR_CB, COLOR_BPR, COLOR_HYB]


# ---------------------------------------------------------------------------
# 1. bpr_selection_top10_metrics.png
#    3 sub-bars: Precision@10, NDCG@10, HitRate@10
#    BPR-MF phai de nhin la tot nhat.
# ---------------------------------------------------------------------------

fig, axes = plt.subplots(1, 3, figsize=(13, 4.6))

metrics = [
    ("Precision@10", precision_10, "(Ty le goi y trung trong top 10)"),
    ("NDCG@10", ndcg_10, "(Xep hang co trong so theo vi tri)"),
    ("HitRate@10", hitrate_10, "(Ty le user co it nhat 1 bai trung trong top 10)"),
]

for ax, (name, values, desc) in zip(axes, metrics):
    bars = ax.bar(algo_short_vi, values, color=colors, edgecolor="white", linewidth=0.8)
    # Highlight BPR-MF bar
    bars[2].set_edgecolor("#1a1a1a")
    bars[2].set_linewidth(1.4)

    # Labels on top of each bar
    for bar, v in zip(bars, values):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + max(values) * 0.02,
            f"{v:.4f}",
            ha="center", va="bottom", fontsize=9, color="#333",
        )

    ax.set_title(f"{name}\n{desc}", fontsize=10.5, color="#222")
    ax.set_ylim(0, max(values) * 1.22)
    ax.grid(axis="y", linestyle="--", alpha=0.4)
    ax.set_axisbelow(True)
    ax.tick_params(axis="x", labelsize=9, rotation=10)
    ax.tick_params(axis="y", labelsize=9)

fig.suptitle(
    "So sanh BPR-MF voi 3 baseline - Top-10 recommendation (200 users, catalog 7.653 bai)",
    fontsize=12.5, fontweight="bold", y=1.02,
)
fig.tight_layout()
out1 = os.path.join(CHARTS_DIR, "bpr_selection_top10_metrics.png")
fig.savefig(out1, dpi=180, bbox_inches="tight")
plt.close(fig)
print(f"da tao: {out1}")


# ---------------------------------------------------------------------------
# 2. bpr_vs_baselines_precision_ndcg.png
#    Scatter-style hoac grouped bar Precision@10 vs NDCG@10.
#    Dung grouped bar de de so sanh truc tiep.
# ---------------------------------------------------------------------------

fig, ax = plt.subplots(figsize=(8.5, 5))

x = np.arange(len(algo_short_vi))
width = 0.36

bars1 = ax.bar(x - width / 2, precision_10, width, label="Precision@10",
               color=[c for c in colors], edgecolor="white", linewidth=0.8)
bars2 = ax.bar(x + width / 2, ndcg_10, width, label="NDCG@10",
               color=[c for c in colors], edgecolor="white", linewidth=0.8, alpha=0.78, hatch="//")

# Highlight BPR-MF bars
for b in (bars1[2], bars2[2]):
    b.set_edgecolor("#1a1a1a")
    b.set_linewidth(1.4)

# Labels
for bars, vals in [(bars1, precision_10), (bars2, ndcg_10)]:
    for bar, v in zip(bars, vals):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.005,
            f"{v:.3f}",
            ha="center", va="bottom", fontsize=9, color="#333",
        )

ax.set_xticks(x)
ax.set_xticklabels(algo_short_vi, fontsize=10)
ax.set_ylabel("Gia tri metric (0-1)", fontsize=11)
ax.set_title("BPR-MF vs baselines: Precision@10 va NDCG@10", fontsize=12.5, fontweight="bold")
ax.set_ylim(0, max(max(precision_10), max(ndcg_10)) * 1.25)
ax.grid(axis="y", linestyle="--", alpha=0.4)
ax.set_axisbelow(True)
ax.legend(loc="upper left", fontsize=10, frameon=False)

ax.text(
    0.99, -0.18,
    "BPR-MF vuot troi ca Precision@10 (0.0985) lan NDCG@10 (0.0978)\n"
    "so voi Content-Based (0.0428 / 0.0470) va Most Popular (0.0273 / 0.0284).",
    transform=ax.transAxes, fontsize=9, color="#444", ha="right", va="top",
)
fig.tight_layout()
out2 = os.path.join(CHARTS_DIR, "bpr_vs_baselines_precision_ndcg.png")
fig.savefig(out2, dpi=180, bbox_inches="tight")
plt.close(fig)
print(f"da tao: {out2}")

print("\nHoan tat. Khong sua file nao khac ngoai 2 bieu do moi.")
