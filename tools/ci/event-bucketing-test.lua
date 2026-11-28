local RGX = assert(_G.RGXFramework, "RGX framework did not load")
local checks = 0
local function check(condition, message)
    if not condition then error("CHECK FAILED: " .. message, 2) end
    checks = checks + 1
end
local function flush(seconds)
    RGX:UpdateTimers(seconds or 1)
end

RGX.timerBudget.maxPerFrame = 100000
RGX.timerBudget.maxSeconds = 60
RGX.timerBudget.slowSeconds = 60

-- Registration validation is additive and refuses malformed options.
check(RGX:RegisterEvent("RGX_BUCKET_BAD", function() end, "bad-zero", nil, { bucket = 0 }) == false, "zero bucket is refused")
check(RGX:RegisterEvent("RGX_BUCKET_BAD", function() end, "bad-negative", nil, { bucket = -1 }) == false, "negative bucket is refused")
check(RGX:RegisterEvent("RGX_BUCKET_BAD", function() end, "bad-nan", nil, { bucket = 0 / 0 }) == false, "NaN bucket is refused")
check(RGX:RegisterEvent("RGX_BUCKET_BAD", function() end, "bad-inf", nil, { bucket = math.huge }) == false, "infinite bucket is refused")
check(RGX:RegisterEvent("RGX_BUCKET_BAD", function() end, "bad-key", nil, { bucket = 0.1, key = true }) == false, "non-function key is refused")
check(RGX:RegisterEvent("RGX_BUCKET_BAD", function() end, "bad-options", nil, true) == false, "non-table options are refused")

-- Unbucketed behavior is unchanged.
local immediate = 0
RGX:RegisterEvent("RGX_IMMEDIATE", function() immediate = immediate + 1 end, "immediate")
RGX:FireEvent("RGX_IMMEDIATE")
RGX:FireEvent("RGX_IMMEDIATE")
check(immediate == 2, "unbucketed callbacks still dispatch immediately")

-- Latest payload per event is delivered once after the bucket interval.
local latest, latestCount, enqueuedAt, measuredLatency
RGX:RegisterEvent("UNIT_HEALTH", function(_, value)
    latest, latestCount = value, (latestCount or 0) + 1
    measuredLatency = (RGX._timerClock or 0) - enqueuedAt
end, "latest", nil, { bucket = 0.25 })
enqueuedAt = RGX._timerClock or 0
RGX:FireEvent("UNIT_HEALTH", 10)
RGX:FireEvent("UNIT_HEALTH", 20)
RGX:FireEvent("UNIT_HEALTH", 30)
check(latestCount == nil, "bucket delays the callback")
flush(0.1)
check(latestCount == nil, "bucket does not flush before its interval")
flush(0.2)
check(latestCount == 1 and latest == 30, "one callback carries only the latest payload")
check(measuredLatency >= 0.25 and measuredLatency <= 0.31, "scheduler latency is the bucket interval, not just CPU time")

-- First-seen key order is deterministic rather than depending on pairs().
local ordered = {}
RGX:RegisterEvent("RGX_ORDER", function(_, key) ordered[#ordered + 1] = key end, "ordered", nil, {
    bucket = 0.1,
    key = function(_, key) return key end,
})
RGX:FireEvent("RGX_ORDER", 3)
RGX:FireEvent("RGX_ORDER", 2)
RGX:FireEvent("RGX_ORDER", 1)
flush(0.2)
check(#ordered == 3 and ordered[1] == 3 and ordered[2] == 2 and ordered[3] == 1, "flush follows first-seen key order")

-- A unit key preserves one latest payload per unit rather than dropping a unit.
local seen = {}
RGX:RegisterUnitEvent("UNIT_POWER", { "player", "target" }, function(_, unit, value)
    seen[unit] = seen[unit] or { count = 0 }
    seen[unit].count = seen[unit].count + 1
    seen[unit].value = value
end, "unit-key", nil, {
    bucket = 0.2,
    key = function(_, unit) return unit end,
})
RGX:FireEvent("UNIT_POWER", "player", 1)
RGX:FireEvent("UNIT_POWER", "target", 2)
RGX:FireEvent("UNIT_POWER", "player", 3)
RGX:FireEvent("UNIT_POWER", "target", 4)
flush(0.3)
check(seen.player and seen.player.count == 1 and seen.player.value == 3, "player keeps its latest payload")
check(seen.target and seen.target.count == 1 and seen.target.value == 4, "target keeps its latest payload")

-- Nil arguments retain their position and arity through the bucket.
local nilA, nilB, nilN
RGX:RegisterEvent("RGX_NILS", function(_, a, b)
    nilA, nilB, nilN = a, b, select("#", a, b)
end, "nils", nil, { bucket = 0.1 })
RGX:FireEvent("RGX_NILS", nil, "second")
flush(0.2)
check(nilA == nil and nilB == "second" and nilN == 2, "nil payload and arity survive")

-- Key failure falls back to the event key and remains failure-isolated.
local keySeen, logBefore = 0, RGX._errorLog and #RGX._errorLog or 0
RGX:RegisterEvent("RGX_KEY_ERROR", function(_, value)
    keySeen = keySeen + 1
end, "key-error", nil, {
    bucket = 0.1,
    key = function() error("expected key failure") end,
})
RGX:FireEvent("RGX_KEY_ERROR", 1)
RGX:FireEvent("RGX_KEY_ERROR", 2)
flush(0.2)
check(keySeen == 1, "a failing key function cannot suppress the callback")
check(RGX._errorLog and #RGX._errorLog > logBefore, "key failure is reported through the existing error log")

-- Legal false and "count" keys cannot collide with metadata; NaN falls back safely.
local special, specialTotal = {}, 0
RGX:RegisterEvent("RGX_SPECIAL_KEYS", function(_, value)
    specialTotal = specialTotal + 1
    if value == value then special[value] = (special[value] or 0) + 1 end
end, "special-keys", nil, {
    bucket = 0.1,
    key = function(_, value) return value end,
})
RGX:FireEvent("RGX_SPECIAL_KEYS", "count")
RGX:FireEvent("RGX_SPECIAL_KEYS", false)
RGX:FireEvent("RGX_SPECIAL_KEYS", 0 / 0)
flush(0.2)
check(special.count == 1, "a key named count cannot overwrite the pending counter")
check(special[false] == 1, "false is retained as a legal key")
check(specialTotal == 3, "NaN falls back to the event key without aborting dispatch")

-- Callback failure in one bucket cannot suppress another handler.
local secondBucket = 0
RGX:RegisterEvent("RGX_BUCKET_THROW", function() error("expected bucket failure") end, "bucket-throw", nil, { bucket = 0.1 })
RGX:RegisterEvent("RGX_BUCKET_THROW", function() secondBucket = secondBucket + 1 end, "bucket-second", nil, { bucket = 0.1 })
RGX:FireEvent("RGX_BUCKET_THROW")
flush(0.2)
check(secondBucket == 1, "a bucket callback failure is isolated")

-- Unregister invalidates pending work; re-registration sees only the new payload.
local reseen = {}
RGX:RegisterEvent("RGX_REREGISTER", function(_, value) reseen[#reseen + 1] = value end, "re-register", nil, { bucket = 0.2 })
RGX:FireEvent("RGX_REREGISTER", "old")
RGX:UnregisterEvent("RGX_REREGISTER", "re-register")
flush(0.3)
check(#reseen == 0, "unregistered bucket never flushes")
RGX:RegisterEvent("RGX_REREGISTER", function(_, value) reseen[#reseen + 1] = value end, "re-register", nil, { bucket = 0.2 })
RGX:FireEvent("RGX_REREGISTER", "new")
flush(0.3)
check(#reseen == 1 and reseen[1] == "new", "stale generation cannot flush into a re-registered handler")

-- Unregister-all invalidates pending work and a later re-registration too.
local allSeen = {}
RGX:RegisterEvent("RGX_UNREGISTER_ALL", function(_, value) allSeen[#allSeen + 1] = value end, "all", nil, { bucket = 0.2 })
RGX:FireEvent("RGX_UNREGISTER_ALL", "old")
RGX:UnregisterAllEvents("all")
flush(0.3)
check(#allSeen == 0, "UnregisterAllEvents suppresses pending callbacks")
RGX:RegisterEvent("RGX_UNREGISTER_ALL", function(_, value) allSeen[#allSeen + 1] = value end, "all", nil, { bucket = 0.2 })
RGX:FireEvent("RGX_UNREGISTER_ALL", "new")
flush(0.3)
check(#allSeen == 1 and allSeen[1] == "new", "unregister-all/re-register sees only the new payload")

-- Public timer cancellation cannot wedge future buckets.
local cancelled = 0
RGX:RegisterEvent("RGX_CANCEL", function() cancelled = cancelled + 1 end, "cancel", nil, { bucket = 0.2 })
RGX:FireEvent("RGX_CANCEL")
RGX:CancelAllTimers()
flush(0.3)
check(cancelled == 0, "cancelling timers cancels the pending flush")
RGX:FireEvent("RGX_CANCEL")
flush(0.3)
check(cancelled == 1, "a later event arms a fresh timer after cancellation")

-- The cap flushes early and never loses a key family.
local cappedEntryId
local cappedSeen, cappedOrder = {}, {}
cappedEntryId = RGX:RegisterEvent("RGX_CAP", function(_, key)
    cappedSeen[key] = (cappedSeen[key] or 0) + 1
    cappedOrder[#cappedOrder + 1] = key
end, "cap", nil, {
    bucket = 0.2,
    key = function(_, key) return key end,
})
for index = 1, 130 do
    local entry = RGX.events.RGX_CAP[cappedEntryId]
    if entry._eventBuckets then
        check(entry._eventBuckets.count <= 128, "pending key count remains bounded")
    end
    RGX:FireEvent("RGX_CAP", index)
end
flush(0.3)
flush(0.3)
for index = 1, 130 do
    check(cappedSeen[index] == 1, "overflow preserves key " .. index)
end

-- Overflow reentrancy cannot overwrite a payload queued by a callback.
local reentrant = {}
RGX:RegisterEvent("RGX_REENTRANT", function(_, key)
    reentrant[#reentrant + 1] = key
    if key == 1 then RGX:FireEvent("RGX_REENTRANT", 130) end
end, "reentrant", nil, {
    bucket = 0.2,
    key = function(_, key) return key end,
})
for index = 1, 129 do RGX:FireEvent("RGX_REENTRANT", index) end
flush(0.3)
flush(0.3)
check(#reentrant == 130, "overflow reentrancy preserves every payload")
for index = 1, 130 do
    check(reentrant[index] == index, "detached overflow and current batches stay FIFO at " .. index)
end

-- Unregistering during an overflow flush stops remaining work and future scheduling.
local stopped = 0
local stopId
stopId = RGX:RegisterEvent("RGX_STOP", function()
    stopped = stopped + 1
    RGX:UnregisterEvent("RGX_STOP", stopId)
end, "stop", nil, {
    bucket = 0.2,
    key = function(_, key) return key end,
})
for index = 1, 129 do RGX:FireEvent("RGX_STOP", index) end
flush(0.3)
check(stopped == 1, "unregister during a detached overflow flush stops all remaining work")
check(RGX:RegisterEvent("RGX_STOP", function() end, "stop", nil, { bucket = 0.2 }) ~= false, "the handler can be registered again after a flush-time unregister")

-- Multiple overflows drain FIFO even on a long tick; the current batch cannot overtake them.
local multi = {}
RGX:RegisterEvent("RGX_MULTI_OVERFLOW", function(_, key) multi[#multi + 1] = key end, "multi-overflow", nil, {
    bucket = 0.2,
    key = function(_, key) return key end,
})
for index = 1, 257 do RGX:FireEvent("RGX_MULTI_OVERFLOW", index) end
flush(0.01)
check(#multi == 256 and multi[1] == 1 and multi[128] == 128 and multi[129] == 129 and multi[256] == 256,
    "two detached overflow batches flush FIFO without the current batch overtaking")
flush(0.3)
check(#multi == 257 and multi[257] == 257, "the current interval batch runs after all overflow batches")

-- Cancelling an active overflow timer does not wedge the remaining FIFO queue.
local cancelOverflow = {}
RGX:RegisterEvent("RGX_CANCEL_OVERFLOW", function(_, key) cancelOverflow[#cancelOverflow + 1] = key end, "cancel-overflow", nil, {
    bucket = 0.2,
    key = function(_, key) return key end,
})
for index = 1, 129 do RGX:FireEvent("RGX_CANCEL_OVERFLOW", index) end
RGX:CancelAllTimers()
RGX:FireEvent("RGX_CANCEL_OVERFLOW", 130)
flush(0.3)
flush(0.3)
check(#cancelOverflow == 130, "a later event re-arms the detached overflow queue after cancellation")
for index = 1, 130 do
    check(cancelOverflow[index] == index, "post-cancellation overflow stays FIFO at " .. index)
end

-- Benchmark: 10,000 immediate callbacks versus one bucketed callback.
local N = 10000
collectgarbage("collect")
local immediateCalls = 0
RGX:RegisterEvent("RGX_BENCH_IMMEDIATE", function() immediateCalls = immediateCalls + 1 end, "bench-immediate")
local immediateHeap = collectgarbage("count")
local immediateStart = os.clock()
for _ = 1, N do RGX:FireEvent("RGX_BENCH_IMMEDIATE") end
local immediateElapsed = os.clock() - immediateStart
local immediateHeapDelta = collectgarbage("count") - immediateHeap
check(immediateCalls == N, "baseline dispatches every event")

collectgarbage("collect")
local bucketCalls = 0
RGX:RegisterEvent("RGX_BENCH_BUCKET", function() bucketCalls = bucketCalls + 1 end, "bench-bucket", nil, { bucket = 0.25 })
local bucketHeap = collectgarbage("count")
local bucketStart = os.clock()
for _ = 1, N do RGX:FireEvent("RGX_BENCH_BUCKET") end
local bucketQueueElapsed = os.clock() - bucketStart
local bucketHeapBeforeFlush = collectgarbage("count") - bucketHeap
check(bucketCalls == 0, "benchmark burst is coalesced before flushing")
flush(0.3)
local bucketElapsed = os.clock() - bucketStart
check(bucketCalls == 1, "benchmark burst becomes exactly one callback")
check(bucketHeapBeforeFlush < 512, "10,000-event burst retains less than 512KB before flushing")

__rgxEventBucketCheckCount = checks
__rgxEventBucketMetrics = string.format(
    "EVENT BUCKETING OK %d checks | immediate: %d calls %.4fs %.1fKB | bucketed: %d calls queue %.4fs total %.4fs pending %.1fKB",
    checks, immediateCalls, immediateElapsed, immediateHeapDelta,
    bucketCalls, bucketQueueElapsed, bucketElapsed, bucketHeapBeforeFlush
)
