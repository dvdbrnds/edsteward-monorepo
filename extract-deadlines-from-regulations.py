#!/usr/bin/env python3
"""
Extract and populate deadlines from regulation descriptions.

This script analyzes regulation data to extract deadline information from:
- filing_deadlines JSONB field
- summary text
- requirements text  
- regulation_text
- submission_guidelines

It then populates the deadlines table with structured deadline data.
"""

import psycopg2
import json
import re
from datetime import datetime, date
from typing import List, Dict, Optional, Tuple
from dateutil import parser
import calendar

# Database connection parameters
DB_CONFIG = {
    'host': 'edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com',
    'database': 'edsteward',
    'user': 'postgres',
    'password': 'EdSteward2024!Secure',
    'port': 5432
}

class DeadlineExtractor:
    def __init__(self):
        self.month_map = {
            'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
            'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6,
            'july': 7, 'jul': 7, 'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'sept': 9,
            'october': 10, 'oct': 10, 'november': 11, 'nov': 11, 'december': 12, 'dec': 12
        }
        
        # Common deadline patterns
        self.deadline_patterns = [
            # Format: "due by January 31st"
            r'due\s+by\s+(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?',
            # Format: "must be submitted by March 15"
            r'must\s+be\s+submitted\s+by\s+(\w+)\s+(\d{1,2})',
            # Format: "deadline is April 30"
            r'deadline\s+is\s+(\w+)\s+(\d{1,2})',
            # Format: "no later than December 31"
            r'no\s+later\s+than\s+(\w+)\s+(\d{1,2})',
            # Format: "January 31 deadline"
            r'(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+deadline',
            # Format: "by January 31st of the year"
            r'by\s+(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+of\s+the\s+year',
            # Format: "April 30th each year"
            r'(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+each\s+year',
            # Format: "quarterly reports due on January 20, April 20, July 20, October 20"
            r'(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,\s*(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?)*',
            # Format: "within 21 days" (we'll default to current year)
            r'within\s+(\d+)\s+days',
            # Format: "90 days after"
            r'(\d+)\s+days\s+after',
            # Format: "January 31, 2025"
            r'(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})',
            # Format: "01/31/2025" or "1/31/25"
            r'(\d{1,2})/(\d{1,2})/(\d{2,4})',
            # Format: "2025-01-31"
            r'(\d{4})-(\d{1,2})-(\d{1,2})'
        ]
    
    def extract_dates_from_text(self, text: str, current_year: int = None) -> List[Tuple[date, str]]:
        """Extract deadline dates from text content."""
        if not text:
            return []
        
        if current_year is None:
            current_year = datetime.now().year
        
        found_dates = []
        text_lower = text.lower()
        
        # Pattern 1: Month Day format
        month_day_pattern = r'(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?'
        matches = re.findall(month_day_pattern, text_lower, re.IGNORECASE)
        
        for month_str, day_str in matches:
            month_num = self.month_map.get(month_str.lower())
            if month_num:
                try:
                    day = int(day_str)
                    if 1 <= day <= 31:
                        # Check if the day is valid for the month
                        max_day = calendar.monthrange(current_year, month_num)[1]
                        if day <= max_day:
                            deadline_date = date(current_year, month_num, day)
                            context = self._extract_context(text, f"{month_str} {day_str}")
                            found_dates.append((deadline_date, context))
                except ValueError:
                    continue
        
        # Pattern 2: MM/DD/YYYY format
        date_pattern = r'(\d{1,2})/(\d{1,2})/(\d{4})'
        matches = re.findall(date_pattern, text)
        
        for month_str, day_str, year_str in matches:
            try:
                month, day, year = int(month_str), int(day_str), int(year_str)
                if 1 <= month <= 12 and 1 <= day <= 31:
                    max_day = calendar.monthrange(year, month)[1]
                    if day <= max_day:
                        deadline_date = date(year, month, day)
                        context = self._extract_context(text, f"{month_str}/{day_str}/{year_str}")
                        found_dates.append((deadline_date, context))
            except ValueError:
                continue
        
        # Pattern 3: YYYY-MM-DD format
        iso_pattern = r'(\d{4})-(\d{1,2})-(\d{1,2})'
        matches = re.findall(iso_pattern, text)
        
        for year_str, month_str, day_str in matches:
            try:
                year, month, day = int(year_str), int(month_str), int(day_str)
                if 1 <= month <= 12 and 1 <= day <= 31:
                    max_day = calendar.monthrange(year, month)[1]
                    if day <= max_day:
                        deadline_date = date(year, month, day)
                        context = self._extract_context(text, f"{year_str}-{month_str}-{day_str}")
                        found_dates.append((deadline_date, context))
            except ValueError:
                continue
        
        return found_dates
    
    def _extract_context(self, text: str, date_str: str) -> str:
        """Extract context around a date mention."""
        # Find the position of the date in the text
        pos = text.lower().find(date_str.lower())
        if pos == -1:
            return ""
        
        # Extract 50 characters before and after the date
        start = max(0, pos - 50)
        end = min(len(text), pos + len(date_str) + 50)
        context = text[start:end].strip()
        
        # Clean up the context
        context = re.sub(r'\s+', ' ', context)
        return context
    
    def parse_filing_deadlines_json(self, filing_deadlines) -> List[Tuple[date, str]]:
        """Parse the filing_deadlines JSONB field."""
        if not filing_deadlines:
            return []
        
        try:
            # Handle both string and already parsed data
            if isinstance(filing_deadlines, str):
                deadlines_data = json.loads(filing_deadlines)
            elif isinstance(filing_deadlines, list):
                deadlines_data = filing_deadlines
            else:
                return []
                
            if not isinstance(deadlines_data, list):
                return []
            
            parsed_dates = []
            current_year = datetime.now().year
            
            for deadline in deadlines_data:
                if not isinstance(deadline, dict):
                    continue
                
                date_str = deadline.get('date', '')
                description = deadline.get('description', '')
                deadline_type = deadline.get('type', '')
                
                if date_str:
                    # Try to parse the date
                    try:
                        # Handle various date formats
                        if re.match(r'\d{4}-\d{2}-\d{2}', date_str):
                            parsed_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                        elif re.match(r'\d{1,2}/\d{1,2}/\d{4}', date_str):
                            parsed_date = datetime.strptime(date_str, '%m/%d/%Y').date()
                        else:
                            # Try dateutil parser as fallback
                            parsed_date = parser.parse(date_str).date()
                        
                        context = f"{deadline_type}: {description}" if deadline_type and description else description or deadline_type
                        parsed_dates.append((parsed_date, context))
                    except (ValueError, parser.ParserError):
                        # If we can't parse the date, try to extract dates from the description
                        if description:
                            extracted_dates = self.extract_dates_from_text(description, current_year)
                            parsed_dates.extend(extracted_dates)
            
            return parsed_dates
        except json.JSONDecodeError:
            return []
    
    def extract_deadlines_from_regulation(self, regulation: Dict) -> List[Dict]:
        """Extract all deadlines from a regulation record."""
        deadlines = []
        reg_id = regulation['id']
        reg_name = regulation['name']
        
        # 1. Parse filing_deadlines JSONB field
        if regulation.get('filing_deadlines'):
            filing_dates = self.parse_filing_deadlines_json(regulation['filing_deadlines'])
            for deadline_date, context in filing_dates:
                deadlines.append({
                    'regulation_id': reg_id,
                    'due_date': deadline_date,
                    'status': 'pending' if deadline_date >= date.today() else 'overdue',
                    'assigned_to': 1,  # Default user
                    'title': f"Filing Deadline - {reg_name}",
                    'description': context,
                    'source': 'filing_deadlines_json'
                })
        
        # 2. Extract from text fields
        text_fields = [
            ('summary', regulation.get('summary', '')),
            ('requirements', regulation.get('requirements', '')),
            ('regulation_text', regulation.get('regulation_text', '')),
            ('submission_guidelines', regulation.get('submission_guidelines', ''))
        ]
        
        for field_name, text_content in text_fields:
            if text_content:
                extracted_dates = self.extract_dates_from_text(text_content)
                for deadline_date, context in extracted_dates:
                    deadlines.append({
                        'regulation_id': reg_id,
                        'due_date': deadline_date,
                        'status': 'pending' if deadline_date >= date.today() else 'overdue',
                        'assigned_to': 1,
                        'title': f"Deadline from {field_name} - {reg_name}",
                        'description': context,
                        'source': field_name
                    })
        
        return deadlines

def main():
    print("🔍 Extracting deadlines from regulation descriptions...")
    
    extractor = DeadlineExtractor()
    
    try:
        # Connect to database
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("✅ Connected to database")
        
        # Get all regulations
        cursor.execute("""
            SELECT id, item_id, name, summary, requirements, regulation_text, 
                   submission_guidelines, filing_deadlines, topic, category
            FROM regulations 
            WHERE is_current = true
            ORDER BY id
        """)
        
        regulations = cursor.fetchall()
        print(f"📋 Found {len(regulations)} regulations to analyze")
        
        # Process each regulation
        all_deadlines = []
        processed_count = 0
        
        for reg_data in regulations:
            regulation = {
                'id': reg_data[0],
                'item_id': reg_data[1],
                'name': reg_data[2],
                'summary': reg_data[3],
                'requirements': reg_data[4],
                'regulation_text': reg_data[5],
                'submission_guidelines': reg_data[6],
                'filing_deadlines': reg_data[7],
                'topic': reg_data[8],
                'category': reg_data[9]
            }
            
            deadlines = extractor.extract_deadlines_from_regulation(regulation)
            all_deadlines.extend(deadlines)
            
            if deadlines:
                print(f"  📅 Found {len(deadlines)} deadlines in regulation {regulation['item_id']}: {regulation['name'][:60]}...")
            
            processed_count += 1
            if processed_count % 50 == 0:
                print(f"    Processed {processed_count}/{len(regulations)} regulations...")
        
        print(f"\n📊 Summary:")
        print(f"  Total regulations processed: {len(regulations)}")
        print(f"  Total deadlines extracted: {len(all_deadlines)}")
        
        if all_deadlines:
            # Group by source
            by_source = {}
            for deadline in all_deadlines:
                source = deadline['source']
                by_source[source] = by_source.get(source, 0) + 1
            
            print(f"  Deadlines by source:")
            for source, count in by_source.items():
                print(f"    {source}: {count}")
            
            # Check for existing deadlines to avoid duplicates
            print("\n🔍 Checking for existing deadlines to avoid duplicates...")
            cursor.execute("SELECT regulation_id, due_date FROM deadlines")
            existing_deadlines = set((row[0], row[1]) for row in cursor.fetchall())
            
            # Filter out duplicates
            new_deadlines = []
            for deadline in all_deadlines:
                key = (deadline['regulation_id'], deadline['due_date'])
                if key not in existing_deadlines:
                    new_deadlines.append(deadline)
            
            duplicate_count = len(all_deadlines) - len(new_deadlines)
            print(f"  Found {duplicate_count} duplicate deadlines (will skip)")
            print(f"  New deadlines to insert: {len(new_deadlines)}")
            
            if new_deadlines:
                # Insert new deadlines
                print("\n💾 Inserting new deadlines into database...")
                
                insert_query = """
                    INSERT INTO deadlines (regulation_id, due_date, status, assigned_to)
                    VALUES (%s, %s, %s, %s)
                """
                
                inserted_count = 0
                for deadline in new_deadlines:
                    try:
                        cursor.execute(insert_query, (
                            deadline['regulation_id'],
                            deadline['due_date'],
                            deadline['status'],
                            deadline['assigned_to']
                        ))
                        inserted_count += 1
                    except Exception as e:
                        print(f"  ❌ Error inserting deadline for regulation {deadline['regulation_id']}: {e}")
                
                conn.commit()
                print(f"  ✅ Successfully inserted {inserted_count} deadlines")
            
            # Show some sample deadlines
            print(f"\n📋 Sample extracted deadlines:")
            for i, deadline in enumerate(new_deadlines[:5]):
                print(f"  {i+1}. Regulation {deadline['regulation_id']}: {deadline['due_date']} ({deadline['status']})")
                print(f"     Source: {deadline['source']}")
                print(f"     Description: {deadline['description'][:80]}...")
                print()
        
        # Final verification
        cursor.execute("SELECT COUNT(*) FROM deadlines")
        total_deadlines = cursor.fetchone()[0]
        print(f"📊 Total deadlines in database: {total_deadlines}")
        
        cursor.close()
        conn.close()
        print("✅ Deadline extraction completed successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main()) 