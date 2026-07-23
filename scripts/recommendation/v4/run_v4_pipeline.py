import subprocess
import sys
import os
import argparse
import time

def run_script(script_name, args=[], dry_run=False):
    print(f"\n{'='*50}")
    print(f"🚀 Running {script_name} {' '.join(args)}")
    print(f"{'='*50}\n")

    if dry_run:
        print(f"DRY RUN: Would execute {script_name} with {args}")
        return True

    script_path = os.path.join(os.path.dirname(__file__), script_name)
    if not os.path.exists(script_path):
        print(f"❌ Error: Script {script_name} not found.")
        return False

    cmd = [sys.executable, script_path] + args
    start_time = time.time()

    try:
        result = subprocess.run(cmd, check=True)
        print(f"\n✅ {script_name} completed in {time.time() - start_time:.2f}s")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error running {script_name}. Exit code: {e.returncode}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Run Recommendation V4 Pipeline")
    parser.add_argument("--users", type=int, default=2000, help="Number of users to generate")
    parser.add_argument("--interactions", type=int, default=600000, help="Total interactions to generate")
    parser.add_argument("--seed", type=int, default=None, help="Random seed")
    parser.add_argument("--dry-run", action="store_true", help="Print commands without running them")
    parser.add_argument("--skip-data", action="store_true", help="Skip data generation")
    parser.add_argument("--skip-lightgcn", action="store_true", help="Skip LightGCN training")
    parser.add_argument("--skip-report", action="store_true", help="Skip report generation")

    args = parser.parse_args()

    print("🎶 Starting MusicFlow Recommendation V4 Pipeline 🎶")
    overall_start = time.time()

    if not args.skip_data:
        data_args = [f"--users={args.users}", f"--interactions={args.interactions}"]
        if args.seed is not None:
            data_args.append(f"--seed={args.seed}")

        success = run_script("generate_v4_experimental_data.py", data_args, args.dry_run)
        if not success: sys.exit(1)

        success = run_script("split_v4_temporal.py", [], args.dry_run)
        if not success: sys.exit(1)

    # Train BPR-MF
    success = run_script("train_bpr_mf_v4.py", [], args.dry_run)
    if not success: sys.exit(1)

    if not args.skip_lightgcn:
        success = run_script("train_lightgcn_v4.py", [], args.dry_run)
        if not success: sys.exit(1)

    # Baselines
    success = run_script("generate_most_popular_v4.py", [], args.dry_run)
    if not success: sys.exit(1)

    success = run_script("generate_content_based_v4.py", [], args.dry_run)
    if not success: sys.exit(1)

    # Hybrid Rerank & Eval
    success = run_script("hybrid_rerank_v4.py", [], args.dry_run)
    if not success: sys.exit(1)

    success = run_script("evaluate_v4_models.py", [], args.dry_run)
    if not success: sys.exit(1)

    if not args.skip_report:
        success = run_script("generate_v4_report.py", [], args.dry_run)
        if not success: sys.exit(1)

    print(f"\n🎉 Pipeline completed successfully in {time.time() - overall_start:.2f}s!")

if __name__ == "__main__":
    main()
