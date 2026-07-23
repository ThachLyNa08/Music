@echo off
echo Running V4 All Users Pipeline...

cd /d "%~dp0"

echo 1. Building Dataset...
python build_v4_all_users_dataset_from_db.py
if %errorlevel% neq 0 exit /b %errorlevel%

echo 2. Splitting Dataset...
python split_v4_all_users.py
if %errorlevel% neq 0 exit /b %errorlevel%

echo 3. Training LightGCN...
python train_lightgcn_v4.py
if %errorlevel% neq 0 exit /b %errorlevel%

echo 4. Training BPR-MF...
python train_bpr_mf_v4.py
if %errorlevel% neq 0 exit /b %errorlevel%

echo 5. Generating Most Popular...
python generate_most_popular_v4.py
if %errorlevel% neq 0 exit /b %errorlevel%

echo 6. Generating Content-Based...
python generate_content_based_v4.py
if %errorlevel% neq 0 exit /b %errorlevel%

echo 7. Running Hybrid Rerank...
python hybrid_rerank_v4.py
if %errorlevel% neq 0 exit /b %errorlevel%

echo 8. Evaluating Models...
python evaluate_v4_models.py
if %errorlevel% neq 0 exit /b %errorlevel%

echo 9. Generating Reports...
python generate_v4_report.py
if %errorlevel% neq 0 exit /b %errorlevel%

echo 10. Generating Serving Artifact...
node generate_serving_recs_v4_all.js
if %errorlevel% neq 0 exit /b %errorlevel%

echo Pipeline finished successfully!
pause
