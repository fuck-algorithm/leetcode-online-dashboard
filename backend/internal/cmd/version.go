package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

const (
	Version = "1.0.0"
)

// NewVersionCommand creates the version command
func NewVersionCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print version information",
		Long:  `Print the version number of LeetCode Dashboard.`,
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("LeetCode Dashboard v%s\n", Version)
		},
	}
}
