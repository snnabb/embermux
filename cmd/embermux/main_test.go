package main

import (
	"bytes"
	"os"
	"strings"
	"testing"
)

func TestRunVersionWritesVersion(t *testing.T) {
	originalVersion := Version
	Version = "test-build"
	defer func() {
		Version = originalVersion
	}()

	var stdout bytes.Buffer
	if err := run([]string{"--version"}, &stdout); err != nil {
		t.Fatalf("run --version returned error: %v", err)
	}

	if got := stdout.String(); got != "EmberMux test-build\n" {
		t.Fatalf("run --version output = %q, want %q", got, "EmberMux test-build\n")
	}
}

func TestRunWithoutConfigReturnsExplicitError(t *testing.T) {
	originalDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("get working directory: %v", err)
	}

	tempDir := t.TempDir()
	if err := os.Chdir(tempDir); err != nil {
		t.Fatalf("chdir temp dir: %v", err)
	}
	defer func() {
		if chdirErr := os.Chdir(originalDir); chdirErr != nil {
			t.Fatalf("restore working directory: %v", chdirErr)
		}
	}()

	var stdout bytes.Buffer
	err = run(nil, &stdout)
	if err == nil {
		t.Fatal("run without config returned nil error")
	}
	if strings.Contains(strings.ToLower(err.Error()), "panic") {
		t.Fatalf("run returned panic-like error: %v", err)
	}
	if !strings.Contains(err.Error(), "config") && !strings.Contains(strings.ToLower(err.Error()), "no such file") {
		t.Fatalf("run returned non-config error: %v", err)
	}
}
