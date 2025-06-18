from services.etl import ETLService

def test_etl():
    etl_service = ETLService()

    # Test CSV validation with correct column mapping
    required_columns = [
        'item_id', 'name', 'topic', 'statute', 'requirements', 
        'category', 'jurisdiction'
    ]

    is_valid, message = etl_service.validate_csv(
        'attached_assets/compliance-matrix.xlsx',
        required_columns
    )
    print(f"Validation result: {is_valid}")
    print(f"Validation message: {message}")

    if is_valid:
        # Test import
        try:
            rows_imported = etl_service.import_csv(
                'attached_assets/compliance-matrix.xlsx',
                'regulations',
                required_columns
            )
            print(f"Successfully imported {rows_imported} rows")
        except Exception as e:
            print(f"Import error: {str(e)}")

if __name__ == "__main__":
    test_etl()