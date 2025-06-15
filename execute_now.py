#!/usr/bin/env python3

# Execute the final restoration script
import subprocess
import sys
import os

# Change to the correct directory
os.chdir('/Users/dvdbrnds/Desktop/ES Clientside/RegulatoryTrackr')

# Execute the restoration script
try:
    result = subprocess.run([sys.executable, 'final_restoration.py'], 
                          capture_output=True, text=True, timeout=300)
    
    print("STDOUT:")
    print(result.stdout)
    
    if result.stderr:
        print("\nSTDERR:")
        print(result.stderr)
    
    print(f"\nReturn code: {result.returncode}")
    
except subprocess.TimeoutExpired:
    print("Script timed out after 5 minutes")
except Exception as e:
    print(f"Error executing script: {e}")