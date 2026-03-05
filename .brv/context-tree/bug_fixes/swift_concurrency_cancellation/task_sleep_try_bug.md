## Swift Game Loop Bug - Task.sleep with try?

**CRITICAL BUG**: Never use `try?` with `Task.sleep` in a game loop!

**Problem:**
```swift
// BAD - silently swallows cancellation, loop runs at max CPU speed
try? await Task.sleep(for: .milliseconds(100))
```

When the Task is cancelled (e.g., view disappears/reappears), `try?` swallows the error and the loop continues immediately without waiting, causing it to run at maximum CPU speed instead of the intended tick rate.

**Solution:**
```swift
// GOOD - properly handle cancellation
do {
    try await Task.sleep(for: .milliseconds(100))
} catch {
    break // Exit loop on cancellation
}
guard !Task.isCancelled else { break }
```

This bug caused tick counts to reach millions in seconds, making mana generation appear much faster than intended.