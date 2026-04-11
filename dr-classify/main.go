package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"example.com/dr-classify/drclassify"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "no input")
		os.Exit(0)
	}

	var nums []int

	for _, arg := range os.Args[1:] {
		if arg == "--" {
			continue
		}
		num, err := strconv.Atoi(arg)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: not an integer: %s\n", arg)
			os.Exit(1)
		}
		if num < 0 {
			fmt.Fprintf(os.Stderr, "error: negative integer %d\n", num)
			os.Exit(1)
		}
		nums = append(nums, num)
	}

	buckets, hasBuckets := drclassify.Bucket(nums)
	if !hasBuckets {
		return
	}

	// Print in canonical order: Exploration → Optimization → Stabilization
	regimes := []drclassify.Regime{
		drclassify.Exploration,
		drclassify.Optimization,
		drclassify.Stabilization,
	}

	for _, regime := range regimes {
		if bucket, exists := buckets[regime]; exists && len(bucket) > 0 {
			var strNums []string
			for _, num := range bucket {
				strNums = append(strNums, fmt.Sprintf("%d", num))
			}
			fmt.Printf("%s:   %s\n", regimeString(regime), strings.Join(strNums, ", "))
		}
	}
}

func regimeString(regime drclassify.Regime) string {
	switch regime {
	case drclassify.Exploration:
		return "Exploration"
	case drclassify.Optimization:
		return "Optimization"
	case drclassify.Stabilization:
		return "Stabilization"
	default:
		return ""
	}
}