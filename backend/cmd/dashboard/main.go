package main

import (
	"log"
	"os"

	"github.com/spf13/cobra"
	"leetcode-dashboard/internal/cmd"
)

func main() {
	rootCmd := &cobra.Command{
		Use:   "leetcode-dashboard",
		Short: "LeetCode Dashboard - Online count tracking system",
		Long: `LeetCode Dashboard tracks online user counts for LeetCode problems
from both leetcode.cn and leetcode.com sites.`,
	}

	// Add subcommands
	rootCmd.AddCommand(cmd.NewServerCommand())
	rootCmd.AddCommand(cmd.NewCrawlerCommand())
	rootCmd.AddCommand(cmd.NewVersionCommand())

	if err := rootCmd.Execute(); err != nil {
		log.Fatal(err)
		os.Exit(1)
	}
}
