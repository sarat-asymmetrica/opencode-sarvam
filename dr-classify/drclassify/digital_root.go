package drclassify

// DigitalRoot computes the digital root of a non-negative integer.
// For n = 0, returns 0. For n > 0, returns 1-9.
func DigitalRoot(n int) int {
	if n == 0 {
		return 0
	}
	// Mathematical formula: dr(n) = 1 + (n-1) % 9
	return 1 + (n-1)%9
}

// Regime represents the classification regime for a digital root.
type Regime int

const (
	Exploration Regime = iota
	Optimization
	Stabilization
)

// Classify returns the regime for a given digital root.
// Returns false if digital root is 0 (no regime).
func Classify(dr int) (Regime, bool) {
	switch dr {
	case 1, 4, 7:
		return Exploration, true
	case 2, 5, 8:
		return Optimization, true
	case 3, 6, 9:
		return Stabilization, true
	default:
		return 0, false // 0 has no regime
	}
}

// Bucket classifies multiple integers into regimes while preserving input order.
func Bucket(nums []int) (map[Regime][]int, bool) {
	buckets := make(map[Regime][]int)

	for _, num := range nums {
		dr := DigitalRoot(num)
		regime, valid := Classify(dr)
		if !valid {
			continue // skip numbers with no regime (like 0)
		}
		buckets[regime] = append(buckets[regime], num)
	}

	return buckets, len(buckets) > 0
}