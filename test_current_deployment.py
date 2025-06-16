#!/usr/bin/env python3
"""Test the current deployment status"""

import requests
import time

def test_deployment():
    print('🧪 Testing current deployment status...')
    
    for attempt in range(5):
        try:
            response = requests.get(
                'http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/regulations',
                timeout=30
            )
            
            print(f'Test {attempt + 1}: Status {response.status_code}')
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    print(f'🎉 SUCCESS! {len(data)} regulations accessible!')
                    print(f'📋 Sample: {data[0].get("name", data[0].get("topic", "Unknown"))}')
                    return True
            elif response.status_code == 401:
                print('   Still getting 401 - authentication fix may need more time')
            else:
                print(f'   Unexpected status: {response.status_code}')
                
        except Exception as e:
            print(f'   Test error: {e}')
        
        if attempt < 4:
            print('   Waiting 60 seconds before next test...')
            time.sleep(60)
        else:
            print('   Testing complete')
    
    return False

if __name__ == "__main__":
    test_deployment() 