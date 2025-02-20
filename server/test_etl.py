from services.etl import ETLService

def test_etl():
    etl_service = ETLService()
    
    # Test CSV validation
    is_valid, message = etl_service.validate_csv(
        'test_data.csv',
        ['id', 'name', 'description']
    )
    print(f"Validation result: {is_valid}")
    print(f"Validation message: {message}")
    
    if is_valid:
        # Test CSV import
        try:
            rows_imported = etl_service.import_csv(
                'test_data.csv',
                'regulations',
                ['id', 'name', 'description']
            )
            print(f"Successfully imported {rows_imported} rows")
        except Exception as e:
            print(f"Import error: {str(e)}")

if __name__ == "__main__":
    test_etl()
