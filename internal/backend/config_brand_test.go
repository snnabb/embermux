package backend

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadConfigStoreDefaultsServerNameToEmberMux(t *testing.T) {
	dir := t.TempDir()
	config := "server:\n  port: 8096\n  id: \"server-1\"\n\nadmin:\n  username: \"admin\"\n  password: \"secret\"\n\nplayback:\n  mode: \"proxy\"\n\ntimeouts:\n  api: 30000\n  global: 15000\n  login: 10000\n  healthCheck: 10000\n  healthInterval: 60000\n\nproxies: []\nupstream: []\n"
	if err := os.WriteFile(filepath.Join(dir, "config.yaml"), []byte(config), 0o644); err != nil {
		t.Fatalf("write config: %v", err)
	}

	chdirForTest(t, dir)

	store, err := LoadConfigStore()
	if err != nil {
		t.Fatalf("LoadConfigStore: %v", err)
	}

	if got := store.Snapshot().Server.Name; got != "EmberMux" {
		t.Fatalf("default server name = %q, want %q", got, "EmberMux")
	}
}
