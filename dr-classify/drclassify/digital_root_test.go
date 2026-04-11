package drclassify

import "testing"

func TestDigitalRoot_singleDigit(t *testing.T) {
	tests := []struct {
		input    int
		expected int
	}{
		{0, 0},
		{1, 1},
		{5, 5},
		{9, 9},
	}

	for _, tt := range tests {
		got := DigitalRoot(tt.input)
		if got != tt.expected {
			t.Errorf("DigitalRoot(%d) = %d; want %d", tt.input, got, tt.expected)
		}
	}
}

func TestDigitalRoot_multiDigit(t *testing.T) {
	// dr(142857) = 1+4+2+8+5+7 = 27 → 2+7 = 9
	got := DigitalRoot(142857)
	if got != 9 {
		t.Errorf("DigitalRoot(142857) = %d; want 9", got)
	}

	// Additional multi-digit test
	got = DigitalRoot(14)
	if got != 5 {
		t.Errorf("DigitalRoot(14) = %d; want 5", got)
	}

	got = DigitalRoot(108)
	if got != 9 {
		t.Errorf("DigitalRoot(108) = %d; want 9", got)
	}

	got = DigitalRoot(55)
	if got != 1 {
		t.Errorf("DigitalRoot(55) = %d; want 1", got)
	}
}

func TestDigitalRoot_zero(t *testing.T) {
	got := DigitalRoot(0)
	if got != 0 {
		t.Errorf("DigitalRoot(0) = %d; want 0", got)
	}
}

func TestClassify_eachRegime(t *testing.T) {
	tests := []struct {
		dr   int
		want Regime
	}{
		{1, Exploration},
		{4, Exploration},
		{7, Exploration},
		{2, Optimization},
		{5, Optimization},
		{8, Optimization},
		{3, Stabilization},
		{6, Stabilization},
		{9, Stabilization},
		{0, 0}, // no regime
	}

	for _, tt := range tests {
		got, valid := Classify(tt.dr)
		if !valid && tt.dr != 0 {
			t.Errorf("Classify(%d): valid=false, want true", tt.dr)
		}
		if valid && got != tt.want {
			t.Errorf("Classify(%d) = %v; want %v", tt.dr, got, tt.want)
		}
	}
}

func TestBucket_multipleInputs(t *testing.T) {
	// Input: 1,14,27,42,55,108,7
	// Expected: Exploration: 1,55,7; Optimization: 14; Stabilization: 27,42,108
	input := []int{1, 14, 27, 42, 55, 108, 7}
	buckets, hasBuckets := Bucket(input)

	if !hasBuckets {
		t.Fatal("Bucket returned false for non-empty input")
	}

	// Check Exploration regime
	exp, ok := buckets[Exploration]
	if !ok {
		t.Error("Missing Exploration regime")
	}
	expectedExp := []int{1, 55, 7}
	if len(exp) != len(expectedExp) {
		t.Errorf("Exploration: got %v; want %v", exp, expectedExp)
	} else {
		for i := range exp {
			if exp[i] != expectedExp[i] {
				t.Errorf("Exploration: got %v; want %v", exp, expectedExp)
				break
			}
		}
	}

	// Check Optimization regime
	opt, ok := buckets[Optimization]
	if !ok {
		t.Error("Missing Optimization regime")
	}
	expectedOpt := []int{14}
	if len(opt) != len(expectedOpt) {
		t.Errorf("Optimization: got %v; want %v", opt, expectedOpt)
	} else {
		for i := range opt {
			if opt[i] != expectedOpt[i] {
				t.Errorf("Optimization: got %v; want %v", opt, expectedOpt)
				break
			}
		}
	}

	// Check Stabilization regime
	stab, ok := buckets[Stabilization]
	if !ok {
		t.Error("Missing Stabilization regime")
	}
	expectedStab := []int{27, 42, 108}
	if len(stab) != len(expectedStab) {
		t.Errorf("Stabilization: got %v; want %v", stab, expectedStab)
	} else {
		for i := range stab {
			if stab[i] != expectedStab[i] {
				t.Errorf("Stabilization: got %v; want %v", stab, expectedStab)
				break
			}
		}
	}
}

func TestBucket_empty(t *testing.T) {
	input := []int{}
	buckets, hasBuckets := Bucket(input)

	if hasBuckets {
		t.Errorf("Bucket returned true for empty input; want false")
	}
	if len(buckets) != 0 {
		t.Errorf("Bucket returned non-empty map for empty input; want empty map")
	}
}

func TestBucket_withZero(t *testing.T) {
	// Test that zero is filtered out (has no regime)
	input := []int{0, 1, 2, 3}
	buckets, hasBuckets := Bucket(input)

	if !hasBuckets {
		t.Error("Bucket returned false for non-empty input with zero")
	}

	// Should only have regimes for 1,2,3
	totalCount := 0
	for _, bucket := range buckets {
		totalCount += len(bucket)
	}

	if totalCount != 3 {
		t.Errorf("Expected 3 items in buckets (excluding zero), got %d", totalCount)
	}
}