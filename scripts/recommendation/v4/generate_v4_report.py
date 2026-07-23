import os
import json
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd

def generate_charts(metrics, chart_dir):
    os.makedirs(chart_dir, exist_ok=True)
    sns.set_theme(style="whitegrid")

    models = list(metrics.keys())
    if not models:
        print("No metrics found to chart.")
        return

    # 1. metrics_overview_v4.png
    perf_metrics = ['Precision@10', 'Recall@10', 'NDCG@10', 'HitRate@10']
    data_overview = []
    for m in models:
        for metric in perf_metrics:
            data_overview.append({'Model': m, 'Metric': metric, 'Score': metrics[m].get(metric, 0)})

    df_overview = pd.DataFrame(data_overview)

    plt.figure(figsize=(10, 6))
    sns.barplot(data=df_overview, x='Metric', y='Score', hue='Model')
    plt.title('Recommendation V4 - Metrics Overview')
    plt.tight_layout()
    plt.savefig(os.path.join(chart_dir, 'metrics_overview_v4.png'), dpi=300)
    plt.close()

    # 2. hitrate_comparison_v4.png
    plt.figure(figsize=(8, 5))
    sns.barplot(data=df_overview[df_overview['Metric'] == 'HitRate@10'], x='Model', y='Score', hue='Model', palette='Set2')
    plt.title('Recommendation V4 - HitRate@10 Comparison')
    plt.tight_layout()
    plt.savefig(os.path.join(chart_dir, 'hitrate_comparison_v4.png'), dpi=300)
    plt.close()

    # 3. coverage_comparison_v4.png
    data_cov = []
    for m in models:
        data_cov.append({'Model': m, 'Metric': 'Coverage@20', 'Score': metrics[m].get('Coverage@20', 0)})
    df_cov = pd.DataFrame(data_cov)
    plt.figure(figsize=(8, 5))
    sns.barplot(data=df_cov, x='Model', y='Score', hue='Model', palette='coolwarm')
    plt.title('Recommendation V4 - Coverage@20 Comparison')
    plt.tight_layout()
    plt.savefig(os.path.join(chart_dir, 'coverage_comparison_v4.png'), dpi=300)
    plt.close()

    # 4. diversity_comparison_v4.png
    div_compare = ['ArtistDiversity@20', 'GenreDiversity@20']
    data_div2 = []
    for m in models:
        for metric in div_compare:
            data_div2.append({'Model': m, 'Metric': metric, 'Score': metrics[m].get(metric, 0)})
    df_div2 = pd.DataFrame(data_div2)
    plt.figure(figsize=(10, 6))
    sns.barplot(data=df_div2, x='Metric', y='Score', hue='Model')
    plt.title('Recommendation V4 - Diversity Comparison')
    plt.tight_layout()
    plt.savefig(os.path.join(chart_dir, 'diversity_comparison_v4.png'), dpi=300)
    plt.close()

    # 5. novelty_comparison_v4.png
    data_nov = []
    for m in models:
        data_nov.append({'Model': m, 'Metric': 'Novelty@20', 'Score': metrics[m].get('Novelty@20', 0)})
    df_nov = pd.DataFrame(data_nov)
    plt.figure(figsize=(8, 5))
    sns.barplot(data=df_nov, x='Model', y='Score', hue='Model', palette='magma')
    plt.title('Recommendation V4 - Novelty@20 Comparison')
    plt.tight_layout()
    plt.savefig(os.path.join(chart_dir, 'novelty_comparison_v4.png'), dpi=300)
    plt.close()

    # 6. lightgcn_vs_bpr_v4.png
    lg_bpr_models = [m for m in models if 'LightGCN' in m or 'BPR' in m]
    if len(lg_bpr_models) >= 2:
        compare_metrics = ['Precision@10', 'Recall@10', 'NDCG@10', 'HitRate@10', 'Coverage@20']
        data_compare = []
        for m in lg_bpr_models:
            for metric in compare_metrics:
                data_compare.append({'Model': m, 'Metric': metric, 'Score': metrics[m].get(metric, 0)})
        df_compare = pd.DataFrame(data_compare)
        plt.figure(figsize=(10, 6))
        sns.barplot(data=df_compare, x='Metric', y='Score', hue='Model')
        plt.title('LightGCN Hybrid vs BPR-MF Hybrid')
        plt.tight_layout()
        plt.savefig(os.path.join(chart_dir, 'lightgcn_vs_bpr_v4.png'), dpi=300)
        plt.close()

    # 7. Training Loss
    models_dir = os.path.join(os.path.dirname(__file__), '../../../storage/recommendation/models/v4')
    bpr_history_file = os.path.join(models_dir, 'training_history_bpr_mf_v4.json')
    lightgcn_history_file = os.path.join(models_dir, 'training_history_lightgcn_v4.json')

    bpr_loss_plotted = False
    if os.path.exists(bpr_history_file):
        try:
            with open(bpr_history_file, 'r') as f:
                bpr_data = json.load(f)
            if 'epoch' in bpr_data and 'loss' in bpr_data:
                plt.figure(figsize=(8, 5))
                plt.plot(bpr_data['epoch'], bpr_data['loss'], label='Training Loss', color='orange')
                plt.title('BPR-MF V4 Training Loss')
                plt.xlabel('Epoch')
                plt.ylabel('Training Loss')
                plt.legend()
                plt.tight_layout()
                plt.savefig(os.path.join(chart_dir, 'training_loss_bpr_mf_v4.png'), dpi=300)
                plt.close()
                bpr_loss_plotted = True
        except Exception as e:
            print(f"Could not generate BPR loss chart: {e}")

    if not bpr_loss_plotted:
        print("Training history not found for BPR-MF. Please rerun training to generate loss charts.")

    lg_loss_plotted = False
    if os.path.exists(lightgcn_history_file):
        try:
            with open(lightgcn_history_file, 'r') as f:
                lg_data = json.load(f)
            if 'epoch' in lg_data and 'loss' in lg_data:
                plt.figure(figsize=(8, 5))
                plt.plot(lg_data['epoch'], lg_data['loss'], label='Training Loss', color='blue')
                plt.title('LightGCN V4 Training Loss')
                plt.xlabel('Epoch')
                plt.ylabel('Training Loss')
                plt.legend()
                plt.tight_layout()
                plt.savefig(os.path.join(chart_dir, 'training_loss_lightgcn_v4.png'), dpi=300)
                plt.close()
                lg_loss_plotted = True
        except Exception as e:
            print(f"Could not generate LightGCN loss chart: {e}")

    if not lg_loss_plotted:
        print("Training history not found for LightGCN. Please rerun training to generate loss charts.")

    # Keep original 3 charts

    # Original Chart 1: Precision/Recall/NDCG/HitRate
    plt.figure(figsize=(10, 6))
    sns.barplot(data=df_overview, x='Metric', y='Score', hue='Model')
    plt.title('Recommendation V4 - Performance Metrics @ 10')
    plt.ylim(0, 1.0)
    plt.tight_layout()
    plt.savefig(os.path.join(chart_dir, 'precision_recall_comparison_v4.png'), dpi=300)
    plt.close()

    # Original Chart 2: Coverage, Diversity, Novelty
    div_metrics = ['Coverage@20', 'ArtistDiversity@20', 'GenreDiversity@20', 'Novelty@20']
    data_div = []
    for m in models:
        for metric in div_metrics:
            data_div.append({'Model': m, 'Metric': metric, 'Score': metrics[m].get(metric, 0)})

    df_div = pd.DataFrame(data_div)

    plt.figure(figsize=(10, 6))
    sns.barplot(data=df_div, x='Metric', y='Score', hue='Model')
    plt.title('Recommendation V4 - Diversity & Novelty @ 20')
    plt.ylim(0, 1.0)
    plt.tight_layout()
    plt.savefig(os.path.join(chart_dir, 'coverage_diversity_novelty_v4.png'), dpi=300)
    plt.close()

    # Original Chart 3: NDCG comparison only
    plt.figure(figsize=(6, 4))
    sns.barplot(data=df_overview[df_overview['Metric'] == 'NDCG@10'], x='Model', y='Score', hue='Model', palette='viridis')
    plt.title('NDCG@10 Comparison')
    plt.ylim(0, 1.0)
    plt.tight_layout()
    plt.savefig(os.path.join(chart_dir, 'ndcg_comparison_v4.png'), dpi=300)
    plt.close()

    return lg_loss_plotted, bpr_loss_plotted

def main():
    eval_dir = os.path.join(os.path.dirname(__file__), '../../../storage/recommendation/evaluation/v4')
    metrics_file = os.path.join(eval_dir, 'metrics_v4.json')
    chart_dir = os.path.join(eval_dir, 'charts')

    if not os.path.exists(metrics_file):
        print("metrics_v4.json not found. Run evaluate_v4_models.py first.")
        return

    with open(metrics_file, 'r') as f:
        metrics = json.load(f)

    lg_loss_plotted, bpr_loss_plotted = generate_charts(metrics, chart_dir)
    print(f"Charts generated successfully in {chart_dir}")

    # Generate Markdown Report
    report_path = os.path.join(os.path.dirname(__file__), '../../../docs/recommendation/v4/RECOMMENDATION_V4_REPORT.md')
    os.makedirs(os.path.dirname(report_path), exist_ok=True)

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("# MusicFlow Recommendation V4 Report\n\n")
        f.write("## 1. Metrics Summary\n\n")

        models = list(metrics.keys())
        if models:
            f.write("| Metric | " + " | ".join(models) + " |\n")
            f.write("|---" + "|---" * len(models) + "|\n")

            all_metrics = list(metrics[models[0]].keys())
            for m in all_metrics:
                row = f"| {m} | " + " | ".join(f"{metrics[model].get(m, 0):.4f}" for model in models) + " |\n"
                f.write(row)

        f.write("\n## 2. Charts\n\n")
        f.write("### 2.1. Metrics Overview\n")
        f.write("![Metrics Overview](../../../storage/recommendation/evaluation/v4/charts/metrics_overview_v4.png)\n\n")

        f.write("### 2.2. HitRate@10 Comparison\n")
        f.write("![HitRate Comparison](../../../storage/recommendation/evaluation/v4/charts/hitrate_comparison_v4.png)\n\n")

        f.write("### 2.3. Coverage@20 Comparison\n")
        f.write("![Coverage Comparison](../../../storage/recommendation/evaluation/v4/charts/coverage_comparison_v4.png)\n\n")

        f.write("### 2.4. Diversity Comparison\n")
        f.write("![Diversity Comparison](../../../storage/recommendation/evaluation/v4/charts/diversity_comparison_v4.png)\n\n")

        f.write("### 2.5. Novelty@20 Comparison\n")
        f.write("![Novelty Comparison](../../../storage/recommendation/evaluation/v4/charts/novelty_comparison_v4.png)\n\n")

        f.write("### 2.6. LightGCN vs BPR-MF\n")
        f.write("![LightGCN vs BPR](../../../storage/recommendation/evaluation/v4/charts/lightgcn_vs_bpr_v4.png)\n\n")

        f.write("### 2.7. Training Loss\n")
        if lg_loss_plotted:
            f.write("![LightGCN Loss](../../../storage/recommendation/evaluation/v4/charts/training_loss_lightgcn_v4.png)\n\n")
        else:
            f.write("Training history not found for LightGCN. Please rerun training to generate loss charts.\n\n")

        if bpr_loss_plotted:
            f.write("![BPR Loss](../../../storage/recommendation/evaluation/v4/charts/training_loss_bpr_mf_v4.png)\n\n")
        else:
            f.write("Training history not found for BPR-MF. Please rerun training to generate loss charts.\n\n")

        f.write("### 2.8. Original Charts\n")
        f.write("![Precision Recall Comparison](../../../storage/recommendation/evaluation/v4/charts/precision_recall_comparison_v4.png)\n\n")
        f.write("![Coverage Diversity Novelty](../../../storage/recommendation/evaluation/v4/charts/coverage_diversity_novelty_v4.png)\n\n")
        f.write("![NDCG Comparison](../../../storage/recommendation/evaluation/v4/charts/ndcg_comparison_v4.png)\n\n")

    print(f"Markdown report generated at {report_path}")

    # Copy to evaluation folder
    eval_report_path = os.path.join(eval_dir, 'evaluation_report_v4.md')
    import shutil
    shutil.copy2(report_path, eval_report_path)
    print(f"Report also copied to {eval_report_path}")

if __name__ == "__main__":
    main()
