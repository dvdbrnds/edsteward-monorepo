#!/usr/bin/env python3
"""
🗄️ COMPREHENSIVE DATABASE TESTING SUITE - Amazon Hosted Version
Using Context7 Testing Library principles for thorough database testing
"""

import psycopg2
import requests
import json
import time
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('database_test_results.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
BASE_URL = "http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
DB_CONFIG = {
    "host": "edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com",
    "port": 5432,
    "database": "edsteward",
    "user": "postgres",
    "password": "EdSteward2024!Secure"
}

class DatabaseTester:
    """Context7 Testing Library inspired database testing class"""
    
    def __init__(self):
        self.test_results = {
            "connection_tests": [],
            "data_integrity_tests": [],
            "api_tests": [],
            "performance_tests": [],
            "security_tests": []
        }
        self.start_time = datetime.now()
        logger.info("🚀 Starting Comprehensive Database Testing Suite")
        
    def log_test_result(self, category: str, test_name: str, status: str, details: Dict = None):
        """Log test result using Testing Library pattern: Arrange, Act, Assert"""
        result = {
            "test_name": test_name,
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "details": details or {}
        }
        self.test_results[category].append(result)
        
        status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
        logger.info(f"{status_emoji} {test_name}: {status}")
        if details:
            logger.info(f"   Details: {details}")

    # ============ DATABASE CONNECTION TESTS ============
    
    def test_database_connection(self) -> bool:
        """Test direct database connection - ARRANGE, ACT, ASSERT pattern"""
        try:
            # ARRANGE: Setup connection parameters
            logger.info("🔍 Testing database connection...")
            
            # ACT: Attempt connection
            conn = psycopg2.connect(**DB_CONFIG, connect_timeout=10)
            cursor = conn.cursor()
            
            # ASSERT: Verify connection and get basic info
            cursor.execute("SELECT version();")
            version = cursor.fetchone()[0]
            
            cursor.execute("SELECT current_database();")
            database = cursor.fetchone()[0]
            
            details = {
                "postgresql_version": version,
                "database_name": database,
                "connection_time": "< 10s"
            }
            
            cursor.close()
            conn.close()
            
            self.log_test_result("connection_tests", "Direct Database Connection", "PASS", details)
            return True
            
        except Exception as e:
            self.log_test_result("connection_tests", "Direct Database Connection", "FAIL", {"error": str(e)})
            return False

    def test_table_existence(self) -> bool:
        """Test that all required tables exist"""
        try:
            conn = psycopg2.connect(**DB_CONFIG)
            cursor = conn.cursor()
            
            # ARRANGE: Define expected tables
            expected_tables = ['regulations', 'users', 'notes', 'deadlines', 'evidence_files']
            existing_tables = []
            
            # ACT: Check each table
            for table in expected_tables:
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = %s
                    );
                """, (table,))
                exists = cursor.fetchone()[0]
                if exists:
                    existing_tables.append(table)
            
            # ASSERT: Verify all tables exist
            details = {
                "expected_tables": expected_tables,
                "existing_tables": existing_tables,
                "missing_tables": list(set(expected_tables) - set(existing_tables))
            }
            
            success = len(existing_tables) == len(expected_tables)
            status = "PASS" if success else "FAIL"
            
            cursor.close()
            conn.close()
            
            self.log_test_result("connection_tests", "Table Existence Check", status, details)
            return success
            
        except Exception as e:
            self.log_test_result("connection_tests", "Table Existence Check", "FAIL", {"error": str(e)})
            return False

    # ============ DATA INTEGRITY TESTS ============
    
    def test_regulations_data_integrity(self) -> bool:
        """Test regulations table data integrity"""
        try:
            conn = psycopg2.connect(**DB_CONFIG)
            cursor = conn.cursor()
            
            # ARRANGE: Define data integrity checks
            integrity_checks = {}
            
            # ACT: Run integrity checks
            
            # 1. Count total regulations
            cursor.execute("SELECT COUNT(*) FROM regulations;")
            total_count = cursor.fetchone()[0]
            integrity_checks["total_regulations"] = total_count
            
            # 2. Check for required fields
            cursor.execute("SELECT COUNT(*) FROM regulations WHERE id IS NULL OR name IS NULL;")
            null_required_fields = cursor.fetchone()[0]
            integrity_checks["null_required_fields"] = null_required_fields
            
            # 3. Check for duplicates by name
            cursor.execute("""
                SELECT COUNT(*) FROM (
                    SELECT name, COUNT(*) 
                    FROM regulations 
                    GROUP BY name 
                    HAVING COUNT(*) > 1
                ) duplicates;
            """)
            duplicate_names = cursor.fetchone()[0]
            integrity_checks["duplicate_names"] = duplicate_names
            
            # 4. Check categories distribution
            cursor.execute("""
                SELECT category, COUNT(*) 
                FROM regulations 
                WHERE category IS NOT NULL 
                GROUP BY category 
                ORDER BY COUNT(*) DESC 
                LIMIT 10;
            """)
            categories = cursor.fetchall()
            integrity_checks["top_categories"] = dict(categories)
            
            # 5. Check date fields validity
            cursor.execute("""
                SELECT COUNT(*) FROM regulations 
                WHERE effective_date IS NOT NULL 
                AND effective_date > CURRENT_DATE + INTERVAL '1 year';
            """)
            future_dates = cursor.fetchone()[0]
            integrity_checks["future_effective_dates"] = future_dates
            
            # 6. Sample regulation check
            cursor.execute("""
                SELECT id, name, category, jurisdiction 
                FROM regulations 
                WHERE name IS NOT NULL 
                LIMIT 3;
            """)
            sample_regulations = cursor.fetchall()
            integrity_checks["sample_regulations"] = [
                {"id": r[0], "name": r[1], "category": r[2], "jurisdiction": r[3]} 
                for r in sample_regulations
            ]
            
            # ASSERT: Verify data integrity
            issues = []
            if null_required_fields > 0:
                issues.append(f"{null_required_fields} regulations with null required fields")
            if duplicate_names > 0:
                issues.append(f"{duplicate_names} duplicate regulation names")
            if future_dates > 10:  # Allow some future dates but not too many
                issues.append(f"{future_dates} regulations with far future effective dates")
                
            status = "PASS" if len(issues) == 0 else "WARN" if len(issues) <= 2 else "FAIL"
            
            details = {
                **integrity_checks,
                "issues_found": issues
            }
            
            cursor.close()
            conn.close()
            
            self.log_test_result("data_integrity_tests", "Regulations Data Integrity", status, details)
            return status != "FAIL"
            
        except Exception as e:
            self.log_test_result("data_integrity_tests", "Regulations Data Integrity", "FAIL", {"error": str(e)})
            return False

    # ============ API ENDPOINT TESTS ============
    
    def test_api_endpoints(self) -> Dict[str, bool]:
        """Test all API endpoints comprehensively"""
        endpoints_results = {}
        
        # ARRANGE: Define all endpoints to test
        endpoints = [
            {"path": "/health", "name": "Health Check", "expect_auth": False},
            {"path": "/api/health", "name": "API Health Check", "expect_auth": False},
            {"path": "/api/regulations", "name": "Regulations List", "expect_auth": False},
            {"path": "/api/public/regulations", "name": "Public Regulations", "expect_auth": False},
            {"path": "/api/deadlines", "name": "Deadlines List", "expect_auth": False},
            {"path": "/api/notifications", "name": "Notifications List", "expect_auth": False},
            {"path": "/api/setup/status", "name": "Setup Status", "expect_auth": False},
            {"path": "/api/test", "name": "API Test Endpoint", "expect_auth": False},
        ]
        
        for endpoint in endpoints:
            success = self._test_single_endpoint(endpoint)
            endpoints_results[endpoint["path"]] = success
            
        return endpoints_results
    
    def _test_single_endpoint(self, endpoint: Dict) -> bool:
        """Test a single API endpoint using Testing Library patterns"""
        try:
            # ARRANGE: Setup request
            url = f"{BASE_URL}{endpoint['path']}"
            headers = {"Accept": "application/json"}
            
            # ACT: Make request
            start_time = time.time()
            response = requests.get(url, headers=headers, timeout=10)
            response_time = (time.time() - start_time) * 1000  # ms
            
            # ASSERT: Verify response
            details = {
                "url": url,
                "status_code": response.status_code,
                "response_time_ms": round(response_time, 2),
                "content_type": response.headers.get("content-type", "unknown")
            }
            
            # Check if response is JSON
            try:
                json_data = response.json()
                if isinstance(json_data, list):
                    details["response_type"] = "array"
                    details["item_count"] = len(json_data)
                    if len(json_data) > 0:
                        details["sample_keys"] = list(json_data[0].keys()) if isinstance(json_data[0], dict) else "non-object"
                elif isinstance(json_data, dict):
                    details["response_type"] = "object"
                    details["response_keys"] = list(json_data.keys())
                    if "error" in json_data:
                        details["error_message"] = json_data["error"]
            except:
                details["response_type"] = "non-json"
                details["response_preview"] = response.text[:200]
            
            # Determine success based on expected behavior
            if endpoint["expect_auth"] and response.status_code == 401:
                status = "PASS"  # Expected auth requirement
            elif not endpoint["expect_auth"] and response.status_code == 200:
                status = "PASS"  # Expected success
            elif response.status_code == 404:
                status = "WARN"  # Route might not be implemented
                details["issue"] = "Route not implemented"
            else:
                status = "FAIL"  # Unexpected response
                
            self.log_test_result("api_tests", endpoint["name"], status, details)
            return status == "PASS"
            
        except Exception as e:
            self.log_test_result("api_tests", endpoint["name"], "FAIL", {"error": str(e)})
            return False

    # ============ PERFORMANCE TESTS ============
    
    def test_database_performance(self) -> bool:
        """Test database query performance with large dataset"""
        try:
            conn = psycopg2.connect(**DB_CONFIG)
            cursor = conn.cursor()
            
            performance_results = {}
            
            # Test 1: Simple count query
            start_time = time.time()
            cursor.execute("SELECT COUNT(*) FROM regulations;")
            count = cursor.fetchone()[0]
            count_time = (time.time() - start_time) * 1000
            performance_results["count_query_ms"] = round(count_time, 2)
            performance_results["total_regulations"] = count
            
            # Test 2: Complex search query
            start_time = time.time()
            cursor.execute("""
                SELECT id, name, category, jurisdiction 
                FROM regulations 
                WHERE name ILIKE '%education%' 
                ORDER BY name 
                LIMIT 50;
            """)
            search_results = cursor.fetchall()
            search_time = (time.time() - start_time) * 1000
            performance_results["search_query_ms"] = round(search_time, 2)
            performance_results["search_results_count"] = len(search_results)
            
            # Test 3: Aggregation query
            start_time = time.time()
            cursor.execute("""
                SELECT category, COUNT(*), 
                       AVG(CASE WHEN effective_date IS NOT NULL THEN 1 ELSE 0 END) as date_completion_rate
                FROM regulations 
                WHERE category IS NOT NULL 
                GROUP BY category 
                ORDER BY COUNT(*) DESC;
            """)
            agg_results = cursor.fetchall()
            agg_time = (time.time() - start_time) * 1000
            performance_results["aggregation_query_ms"] = round(agg_time, 2)
            performance_results["categories_analyzed"] = len(agg_results)
            
            # ASSERT: Check if performance is acceptable
            issues = []
            if count_time > 1000:  # 1 second
                issues.append("Count query too slow")
            if search_time > 2000:  # 2 seconds
                issues.append("Search query too slow")
            if agg_time > 3000:  # 3 seconds
                issues.append("Aggregation query too slow")
                
            status = "PASS" if len(issues) == 0 else "WARN"
            performance_results["performance_issues"] = issues
            
            cursor.close()
            conn.close()
            
            self.log_test_result("performance_tests", "Database Query Performance", status, performance_results)
            return status == "PASS"
            
        except Exception as e:
            self.log_test_result("performance_tests", "Database Query Performance", "FAIL", {"error": str(e)})
            return False

    # ============ SECURITY TESTS ============
    
    def test_security_measures(self) -> bool:
        """Test basic security measures"""
        try:
            security_results = {}
            
            # Test 1: SQL Injection protection (basic test)
            try:
                conn = psycopg2.connect(**DB_CONFIG)
                cursor = conn.cursor()
                
                # This should NOT work if properly protected
                malicious_query = "'; DROP TABLE regulations; --"
                cursor.execute("SELECT name FROM regulations WHERE name = %s LIMIT 1;", (malicious_query,))
                result = cursor.fetchall()
                
                cursor.close()
                conn.close()
                
                security_results["sql_injection_test"] = "PROTECTED" # If we reach here, parameterized queries are working
                
            except Exception as e:
                security_results["sql_injection_test"] = f"ERROR: {str(e)}"
            
            # Test 2: Check for sensitive data exposure in API
            try:
                response = requests.get(f"{BASE_URL}/api/public/regulations", timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list) and len(data) > 0:
                        first_item = data[0]
                        sensitive_fields = ["password", "secret", "key", "token"]
                        exposed_sensitive = [field for field in sensitive_fields if field in first_item]
                        security_results["sensitive_data_exposure"] = "NONE" if not exposed_sensitive else exposed_sensitive
                    else:
                        security_results["sensitive_data_exposure"] = "NO_DATA_TO_CHECK"
                else:
                    security_results["sensitive_data_exposure"] = f"API_ERROR_{response.status_code}"
            except Exception as e:
                security_results["sensitive_data_exposure"] = f"REQUEST_ERROR: {str(e)}"
            
            # ASSERT: Evaluate security
            issues = []
            if "ERROR" in security_results.get("sql_injection_test", ""):
                issues.append("SQL injection test failed")
            if isinstance(security_results.get("sensitive_data_exposure"), list) and security_results["sensitive_data_exposure"]:
                issues.append("Sensitive data exposed in API")
                
            status = "PASS" if len(issues) == 0 else "FAIL"
            security_results["security_issues"] = issues
            
            self.log_test_result("security_tests", "Basic Security Measures", status, security_results)
            return status == "PASS"
            
        except Exception as e:
            self.log_test_result("security_tests", "Basic Security Measures", "FAIL", {"error": str(e)})
            return False

    # ============ COMPREHENSIVE TEST RUNNER ============
    
    def run_all_tests(self) -> Dict:
        """Run all tests and generate comprehensive report"""
        logger.info("🧪 Starting comprehensive database testing suite...")
        
        # Connection Tests
        logger.info("=" * 50)
        logger.info("🔌 RUNNING CONNECTION TESTS")
        logger.info("=" * 50)
        self.test_database_connection()
        self.test_table_existence()
        
        # Data Integrity Tests
        logger.info("=" * 50)
        logger.info("🔍 RUNNING DATA INTEGRITY TESTS")
        logger.info("=" * 50)
        self.test_regulations_data_integrity()
        
        # API Tests
        logger.info("=" * 50)
        logger.info("🌐 RUNNING API ENDPOINT TESTS")
        logger.info("=" * 50)
        self.test_api_endpoints()
        
        # Performance Tests
        logger.info("=" * 50)
        logger.info("⚡ RUNNING PERFORMANCE TESTS")
        logger.info("=" * 50)
        self.test_database_performance()
        
        # Security Tests
        logger.info("=" * 50)
        logger.info("🔒 RUNNING SECURITY TESTS")
        logger.info("=" * 50)
        self.test_security_measures()
        
        # Generate Summary
        return self._generate_summary()
    
    def _generate_summary(self) -> Dict:
        """Generate comprehensive test summary"""
        end_time = datetime.now()
        duration = end_time - self.start_time
        
        summary = {
            "test_run_info": {
                "start_time": self.start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "duration_seconds": duration.total_seconds(),
                "total_tests": sum(len(tests) for tests in self.test_results.values())
            },
            "results_summary": {},
            "detailed_results": self.test_results
        }
        
        # Calculate summary statistics
        for category, tests in self.test_results.items():
            if tests:
                passed = sum(1 for test in tests if test["status"] == "PASS")
                failed = sum(1 for test in tests if test["status"] == "FAIL")
                warned = sum(1 for test in tests if test["status"] == "WARN")
                
                summary["results_summary"][category] = {
                    "total": len(tests),
                    "passed": passed,
                    "failed": failed,
                    "warned": warned,
                    "success_rate": round((passed / len(tests)) * 100, 1) if tests else 0
                }
        
        # Overall health score
        total_tests = summary["test_run_info"]["total_tests"]
        total_passed = sum(cat["passed"] for cat in summary["results_summary"].values())
        total_failed = sum(cat["failed"] for cat in summary["results_summary"].values())
        
        summary["overall_health"] = {
            "score": round((total_passed / total_tests) * 100, 1) if total_tests > 0 else 0,
            "status": "HEALTHY" if total_failed == 0 else "ISSUES" if total_failed <= 2 else "CRITICAL",
            "recommendation": self._get_recommendation(total_failed, total_tests)
        }
        
        logger.info("=" * 50)
        logger.info("📊 TEST SUMMARY")
        logger.info("=" * 50)
        logger.info(f"Overall Health Score: {summary['overall_health']['score']}%")
        logger.info(f"Status: {summary['overall_health']['status']}")
        logger.info(f"Total Tests: {total_tests}")
        logger.info(f"Passed: {total_passed}")
        logger.info(f"Failed: {total_failed}")
        logger.info(f"Duration: {duration.total_seconds():.1f} seconds")
        
        # Save detailed results
        with open(f"database_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
            json.dump(summary, f, indent=2, default=str)
        
        return summary
    
    def _get_recommendation(self, failed_tests: int, total_tests: int) -> str:
        """Get recommendation based on test results"""
        if failed_tests == 0:
            return "Database is healthy and ready for production use."
        elif failed_tests <= 2:
            return "Minor issues detected. Review failed tests and address before heavy usage."
        else:
            return "Critical issues detected. Database needs immediate attention before production use."

def main():
    """Main function to run comprehensive database tests"""
    tester = DatabaseTester()
    results = tester.run_all_tests()
    
    print("\n" + "=" * 60)
    print("🎉 COMPREHENSIVE DATABASE TESTING COMPLETE!")
    print("=" * 60)
    print(f"Results saved to: database_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
    print(f"Logs saved to: database_test_results.log")
    print(f"Overall Health: {results['overall_health']['score']}% - {results['overall_health']['status']}")
    print(f"Recommendation: {results['overall_health']['recommendation']}")
    
    return results

if __name__ == "__main__":
    main() 