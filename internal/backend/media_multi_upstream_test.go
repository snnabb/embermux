package backend

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestUserItemsParentAggregatesAcrossInstancesAndDeduplicatesSeasons(t *testing.T) {
	var primaryCalls atomic.Int32
	var secondaryCalls atomic.Int32

	primary := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/Users/AuthenticateByName":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"AccessToken": "token-a",
				"User":        map[string]any{"Id": "user-a"},
			})
		case r.Method == http.MethodGet && r.URL.Path == "/Users/user-a/Items":
			primaryCalls.Add(1)
			if got := r.URL.Query().Get("ParentId"); got != "series-a" {
				t.Errorf("primary ParentId = %q, want series-a", got)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"Items": []map[string]any{
					{"Id": "season-a1", "Type": "Season", "SeriesName": "Ruri Dragon", "IndexNumber": 1, "Name": "Season 1A", "Source": "primary-dup"},
					{"Id": "season-a2", "Type": "Season", "SeriesName": "Ruri Dragon", "IndexNumber": 2, "Name": "Season 2A", "Source": "primary-unique"},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer primary.Close()

	secondary := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/Users/AuthenticateByName":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"AccessToken": "token-b",
				"User":        map[string]any{"Id": "user-b"},
			})
		case r.Method == http.MethodGet && r.URL.Path == "/Users/user-b/Items":
			secondaryCalls.Add(1)
			if got := r.URL.Query().Get("ParentId"); got != "series-b" {
				t.Errorf("secondary ParentId = %q, want series-b", got)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"Items": []map[string]any{
					{"Id": "season-b1", "Type": "Season", "SeriesName": "Ruri Dragon", "IndexNumber": 1, "Name": "Season 1B", "Source": "secondary-dup"},
					{"Id": "season-b3", "Type": "Season", "SeriesName": "Ruri Dragon", "IndexNumber": 3, "Name": "Season 3B", "Source": "secondary-unique"},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer secondary.Close()

	config := fmt.Sprintf("server:\n  port: 8096\n  name: \"Test Server\"\n  id: \"server-1\"\n\nadmin:\n  username: \"admin\"\n  password: \"secret\"\n\nplayback:\n  mode: \"proxy\"\n\ntimeouts:\n  api: 30000\n  global: 15000\n  login: 10000\n  healthCheck: 10000\n  healthInterval: 60000\n\nproxies: []\nupstream:\n  - name: \"A\"\n    url: %q\n    username: \"u1\"\n    password: \"p1\"\n  - name: \"B\"\n    url: %q\n    username: \"u2\"\n    password: \"p2\"\n", primary.URL, secondary.URL)

	withTempAppConfig(t, config, func(app *App, handler http.Handler) {
		token := loginToken(t, handler, "secret")
		virtualSeries := app.IDStore.GetOrCreateVirtualID("series-a", 0)
		app.IDStore.AssociateAdditionalInstance(virtualSeries, "series-b", 1)

		rr := doJSONRequest(t, handler, http.MethodGet, "/Users/"+app.Auth.ProxyUserID()+"/Items?ParentId="+virtualSeries, nil, token)
		if rr.Code != http.StatusOK {
			t.Fatalf("items status = %d, body=%s", rr.Code, rr.Body.String())
		}
		var payload map[string]any
		if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
			t.Fatalf("unmarshal items: %v", err)
		}
		items, _ := payload["Items"].([]any)
		if len(items) != 3 {
			t.Fatalf("item count = %d, want 3 payload=%#v", len(items), payload)
		}
		if primaryCalls.Load() != 1 || secondaryCalls.Load() != 1 {
			t.Fatalf("unexpected upstream call counts: primary=%d secondary=%d", primaryCalls.Load(), secondaryCalls.Load())
		}

		first := items[0].(map[string]any)
		firstID, _ := first["Id"].(string)
		resolved := app.IDStore.ResolveVirtualID(firstID)
		if resolved == nil || len(resolved.OtherInstances) != 1 || resolved.OtherInstances[0].OriginalID != "season-b1" {
			t.Fatalf("season duplicate association missing: %#v", resolved)
		}
	})
}

func TestGetItemKeySupportsSeasonDeduplication(t *testing.T) {
	item := map[string]any{
		"Type":        "Season",
		"SeriesName":  "Ruri Dragon",
		"IndexNumber": 1,
	}

	if got := getItemKey(item); got != "season:ruri dragon:S1" {
		t.Fatalf("getItemKey() = %q, want %q", got, "season:ruri dragon:S1")
	}
}
