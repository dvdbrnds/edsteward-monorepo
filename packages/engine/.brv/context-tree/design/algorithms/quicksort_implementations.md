JavaScript Quicksort Implementation

A complete quicksort algorithm implementation in JavaScript with multiple approaches:

```javascript
// Basic Quicksort Implementation
function quicksort(arr) {
    if (arr.length <= 1) {
        return arr;
    }
    
    const pivot = arr[Math.floor(arr.length / 2)];
    const left = [];
    const right = [];
    const equal = [];
    
    for (let element of arr) {
        if (element < pivot) {
            left.push(element);
        } else if (element > pivot) {
            right.push(element);
        } else {
            equal.push(element);
        }
    }
    
    return [...quicksort(left), ...equal, ...quicksort(right)];
}

// In-place Quicksort (more memory efficient)
function quicksortInPlace(arr, low = 0, high = arr.length - 1) {
    if (low < high) {
        const pivotIndex = partition(arr, low, high);
        quicksortInPlace(arr, low, pivotIndex - 1);
        quicksortInPlace(arr, pivotIndex + 1, high);
    }
    return arr;
}

function partition(arr, low, high) {
    const pivot = arr[high];
    let i = low - 1;
    
    for (let j = low; j < high; j++) {
        if (arr[j] <= pivot) {
            i++;
            [arr[i], arr[j]] = [arr[j], arr[i]]; // Swap elements
        }
    }
    
    [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]]; // Place pivot
    return i + 1;
}

// Usage examples:
const numbers = [64, 34, 25, 12, 22, 11, 90];
console.log('Original:', numbers);
console.log('Sorted (basic):', quicksort([...numbers]));

const numbersInPlace = [...numbers];
quicksortInPlace(numbersInPlace);
console.log('Sorted (in-place):', numbersInPlace);
```

Key features:
- Basic version creates new arrays (easier to understand)
- In-place version modifies original array (memory efficient)
- Time complexity: O(n log n) average, O(n²) worst case
- Space complexity: O(log n) for in-place version
- Uses middle element as pivot to reduce worst-case scenarios
- Handles duplicate elements correctly with three-way partitioning