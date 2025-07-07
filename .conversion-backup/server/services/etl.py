import os
import csv
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class ETLService:
    def __init__(self):
        self.db_url = os.getenv('DATABASE_URL')
        if not self.db_url:
            raise ValueError("DATABASE_URL environment variable is not set")

    def get_connection(self):
        """Create and return a database connection"""
        try:
            return psycopg2.connect(self.db_url)
        except psycopg2.Error as e:
            logger.error(f"Database connection error: {e}")
            raise

    def import_csv(self, file_path, table_name, columns):
        """
        Import data from a CSV file into the specified database table

        Args:
            file_path (str): Path to the CSV file
            table_name (str): Name of the target database table
            columns (list): List of column names in the CSV file
        """
        try:
            # Read CSV data
            rows = []
            with open(file_path, 'r') as csv_file:
                csv_reader = csv.DictReader(csv_file)
                for row in csv_reader:
                    # Only include specified columns
                    filtered_row = [row[col] for col in columns if col in row]
                    rows.append(filtered_row)

            if not rows:
                logger.warning("No data found in CSV file")
                return 0

            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    # Prepare column names for the query
                    column_names = ', '.join(columns)

                    # Prepare the INSERT statement for execute_values
                    insert_query = f"""
                        INSERT INTO {table_name} ({column_names})
                        VALUES %s
                    """

                    # Execute batch insert using execute_values
                    execute_values(cur, insert_query, rows)

                    logger.info(f"Successfully imported {len(rows)} rows into {table_name}")
                    return len(rows)

        except FileNotFoundError:
            logger.error(f"CSV file not found: {file_path}")
            raise
        except psycopg2.Error as e:
            logger.error(f"Database error during import: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error during import: {e}")
            raise

    def validate_csv(self, file_path, expected_columns):
        """
        Validate the structure of a CSV file

        Args:
            file_path (str): Path to the CSV file
            expected_columns (list): List of expected column names

        Returns:
            tuple: (is_valid, error_message)
        """
        try:
            with open(file_path, 'r') as csv_file:
                csv_reader = csv.reader(csv_file)
                headers = next(csv_reader)

                # Check if all expected columns are present
                missing_columns = [col for col in expected_columns if col not in headers]
                if missing_columns:
                    return False, f"Missing required columns: {', '.join(missing_columns)}"

                # Validate that there is data in the file
                try:
                    first_row = next(csv_reader)
                    if not first_row:
                        return False, "CSV file is empty"
                except StopIteration:
                    return False, "CSV file contains only headers"

                return True, "CSV structure is valid"

        except FileNotFoundError:
            return False, f"CSV file not found: {file_path}"
        except Exception as e:
            return False, f"Error validating CSV: {str(e)}"

# Example usage:
# etl_service = ETLService()
# result = etl_service.import_csv('data.csv', 'regulations', ['id', 'name', 'description'])