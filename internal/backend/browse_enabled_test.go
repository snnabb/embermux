package backend

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestAdminUpstreamListReportsBrowseEnabledDefaultsAndOverrides(t *testing.T) {
	makeUpstream := func(token, userID string) *httptest.Server {
		return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch {
			case r.Method == http.MethodPost && r.URL.Path == "/Users/AuthenticateByName":
				_ = json.NewEncoder(w).Encode(map[string]any{"AccessToken": token, "User": map[string]any{"Id": userID}})
			default:
				http.NotFound(w, r)
			}
		}))
	}

	upstreamA := makeUpstream("token-a", "user-a")
	defer upstreamA.Close()
	upstreamB := makeUpstream("token-b", "user-b")
	defer upstreamB.Close()

	config := fmt.Sprintf("server:\n  port: 8096\n  name: \"Test Server\"\n  id: \"server-1\"\n\nadmin:\n  username: \"admin\"\n  password: \"secret\"\n\nplayback:\n  mode: \"proxy\"\n\ntimeouts:\n  api: 30000\n  global: 15000\n  login: 10000\n  healthCheck: 10000\n  healthInterval: 60000\n\nproxies: []\nupstream:\n  - name: \"A\"\n    url: %q\n    username: \"u1\"\n    password: \"p1\"\n  - name: \"B\"\n    url: %q\n    username: \"u2\"\n    password: \"p2\"\n    browseEnabled: false\n", upstreamA.URL, upstreamB.URL)

	withTempAppConfig(t, config, func(app *App, handler http.Handler) {
		token := loginToken(t, handler, "secret")
		rr := doJSONRequest(t, handler, http.MethodGet, "/admin/api/upstream", nil, token)
		if rr.Code != http.StatusOK {
			t.Fatalf("list upstream status = %d body=%s", rr.Code, rr.Body.String())
		}

		var list []map[string]any
		if err := json.Unmarshal(rr.Body.Bytes(), &list); err != nil {
			t.Fatalf("unmarshal upstream list: %v", err)
		}
		if len(list) != 2 {
			t.Fatalf("upstream count = %d, want 2", len(list))
		}
		if list[0]["browseEnabled"] != true {
			t.Fatalf("first upstream browseEnabled = %#v, want true", list[0]["browseEnabled"])
		}
		if list[1]["browseEnabled"] != false {
			t.Fatalf("second upstream browseEnabled = %#v, want false", list[1]["browseEnabled"])
		}
	})
}

func TestUserItemsSkipsBrowseDisabledUpstream(t *testing.T) {
	var enabledCalls atomic.Int32
	var disabledCalls atomic.Int32

	enabled := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/Users/AuthenticateByName":
			_ = json.NewEncoder(w).Encode(map[string]any{"AccessToken": "token-a", "User": map[string]any{"Id": "user-a"}})
		case r.Method == http.MethodGet && r.URL.Path == "/Users/user-a/Items":
			enabledCalls.Add(1)
			_ = json.NewEncoder(w).Encode(map[string]any{"Items": []map[string]any{{"Id": "item-a", "Type": "Series", "Name": "Enabled"}}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer enabled.Close()

	disabled := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/Users/AuthenticateByName":
			_ = json.NewEncoder(w).Encode(map[string]any{"AccessToken": "token-b", "User": map[string]any{"Id": "user-b"}})
		case r.Method == http.MethodGet && r.URL.Path == "/Users/user-b/Items":
			disabledCalls.Add(1)
			_ = json.NewEncoder(w).Encode(map[string]any{"Items": []map[string]any{{"Id": "item-b", "Type": "Series", "Name": "Disabled"}}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer disabled.Close()

	config := fmt.Sprintf("server:\n  port: 8096\n  name: \"Test Server\"\n  id: \"server-1\"\n\nadmin:\n  username: \"admin\"\n  password: \"secret\"\n\nplayback:\n  mode: \"proxy\"\n\ntimeouts:\n  api: 30000\n  global: 15000\n  login: 10000\n  healthCheck: 10000\n  healthInterval: 60000\n\nproxies: []\nupstream:\n  - name: \"A\"\n    url: %q\n    username: \"u1\"\n    password: \"p1\"\n  - name: \"B\"\n    url: %q\n    username: \"u2\"\n    password: \"p2\"\n    browseEnabled: false\n", enabled.URL, disabled.URL)

	withTempAppConfig(t, config, func(app *App, handler http.Handler) {
		token := loginToken(t, handler, "secret")
		rr := doJSONRequest(t, handler, http.MethodGet, "/Users/"+app.Auth.ProxyUserID()+"/Items", nil, token)
		if rr.Code != http.StatusOK {
			t.Fatalf("items status = %d body=%s", rr.Code, rr.Body.String())
		}

		var payload map[string]any
		if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
			t.Fatalf("unmarshal items: %v", err)
		}
		items, _ := payload["Items"].([]any)
		if len(items) != 1 {
			t.Fatalf("item count = %d, want 1 payload=%#v", len(items), payload)
		}
		if enabledCalls.Load() != 1 {
			t.Fatalf("enabled upstream call count = %d, want 1", enabledCalls.Load())
		}
		if disabledCalls.Load() != 0 {
			t.Fatalf("disabled upstream should not be called, got %d", disabledCalls.Load())
		}
	})
}

func TestUserViewsSkipsBrowseDisabledUpstream(t *testing.T) {
	var enabledCalls atomic.Int32
	var disabledCalls atomic.Int32

	enabled := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/Users/AuthenticateByName":
			_ = json.NewEncoder(w).Encode(map[string]any{"AccessToken": "token-a", "User": map[string]any{"Id": "user-a"}})
		case r.Method == http.MethodGet && r.URL.Path == "/Users/user-a/Views":
			enabledCalls.Add(1)
			_ = json.NewEncoder(w).Encode(map[string]any{"Items": []map[string]any{{"Id": "view-a", "Name": "Enabled Views"}}, "TotalRecordCount": 1})
		default:
			http.NotFound(w, r)
		}
	}))
	defer enabled.Close()

	disabled := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/Users/AuthenticateByName":
			_ = json.NewEncoder(w).Encode(map[string]any{"AccessToken": "token-b", "User": map[string]any{"Id": "user-b"}})
		case r.Method == http.MethodGet && r.URL.Path == "/Users/user-b/Views":
			disabledCalls.Add(1)
			_ = json.NewEncoder(w).Encode(map[string]any{"Items": []map[string]any{{"Id": "view-b", "Name": "Disabled Views"}}, "TotalRecordCount": 1})
		default:
			http.NotFound(w, r)
		}
	}))
	defer disabled.Close()

	config := fmt.Sprintf("server:\n  port: 8096\n  name: \"Test Server\"\n  id: \"server-1\"\n\nadmin:\n  username: \"admin\"\n  password: \"secret\"\n\nplayback:\n  mode: \"proxy\"\n\ntimeouts:\n  api: 30000\n  global: 15000\n  login: 10000\n  healthCheck: 10000\n  healthInterval: 60000\n\nproxies: []\nupstream:\n  - name: \"A\"\n    url: %q\n    username: \"u1\"\n    password: \"p1\"\n  - name: \"B\"\n    url: %q\n    username: \"u2\"\n    password: \"p2\"\n    browseEnabled: false\n", enabled.URL, disabled.URL)

	withTempAppConfig(t, config, func(app *App, handler http.Handler) {
		token := loginToken(t, handler, "secret")
		rr := doJSONRequest(t, handler, http.MethodGet, "/Users/"+app.Auth.ProxyUserID()+"/Views", nil, token)
		if rr.Code != http.StatusOK {
			t.Fatalf("views status = %d body=%s", rr.Code, rr.Body.String())
		}

		var payload map[string]any
		if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
			t.Fatalf("unmarshal views: %v", err)
		}
		items, _ := payload["Items"].([]any)
		if len(items) != 1 {
			t.Fatalf("view count = %d, want 1 payload=%#v", len(items), payload)
		}
		if enabledCalls.Load() != 1 {
			t.Fatalf("enabled view call count = %d, want 1", enabledCalls.Load())
		}
		if disabledCalls.Load() != 0 {
			t.Fatalf("disabled upstream views should not be called, got %d", disabledCalls.Load())
		}
	})
}

func TestSearchHintsSkipsBrowseDisabledUpstream(t *testing.T) {
	var enabledCalls atomic.Int32
	var disabledCalls atomic.Int32

	enabled := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/Users/AuthenticateByName":
			_ = json.NewEncoder(w).Encode(map[string]any{"AccessToken": "token-a", "User": map[string]any{"Id": "user-a"}})
		case r.Method == http.MethodGet && r.URL.Path == "/Search/Hints":
			enabledCalls.Add(1)
			_ = json.NewEncoder(w).Encode(map[string]any{"SearchHints": []map[string]any{{"Id": "series-a", "Type": "Series", "Name": "Enabled Hint"}}, "TotalRecordCount": 1})
		default:
			http.NotFound(w, r)
		}
	}))
	defer enabled.Close()

	disabled := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/Users/AuthenticateByName":
			_ = json.NewEncoder(w).Encode(map[string]any{"AccessToken": "token-b", "User": map[string]any{"Id": "user-b"}})
		case r.Method == http.MethodGet && r.URL.Path == "/Search/Hints":
			disabledCalls.Add(1)
			_ = json.NewEncoder(w).Encode(map[string]any{"SearchHints": []map[string]any{{"Id": "series-b", "Type": "Series", "Name": "Disabled Hint"}}, "TotalRecordCount": 1})
		default:
			http.NotFound(w, r)
		}
	}))
	defer disabled.Close()

	config := fmt.Sprintf("server:\n  port: 8096\n  name: \"Test Server\"\n  id: \"server-1\"\n\nadmin:\n  username: \"admin\"\n  password: \"secret\"\n\nplayback:\n  mode: \"proxy\"\n\ntimeouts:\n  api: 30000\n  global: 15000\n  login: 10000\n  healthCheck: 10000\n  healthInterval: 60000\n\nproxies: []\nupstream:\n  - name: \"A\"\n    url: %q\n    username: \"u1\"\n    password: \"p1\"\n  - name: \"B\"\n    url: %q\n    username: \"u2\"\n    password: \"p2\"\n    browseEnabled: false\n", enabled.URL, disabled.URL)

	withTempAppConfig(t, config, func(app *App, handler http.Handler) {
		token := loginToken(t, handler, "secret")
		rr := doJSONRequest(t, handler, http.MethodGet, "/Search/Hints?SearchTerm=enabled", nil, token)
		if rr.Code != http.StatusOK {
			t.Fatalf("search hints status = %d body=%s", rr.Code, rr.Body.String())
		}

		var payload map[string]any
		if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
			t.Fatalf("unmarshal search hints: %v", err)
		}
		hints, _ := payload["SearchHints"].([]any)
		if len(hints) != 1 {
			t.Fatalf("hint count = %d, want 1 payload=%#v", len(hints), payload)
		}
		if enabledCalls.Load() != 1 {
			t.Fatalf("enabled search call count = %d, want 1", enabledCalls.Load())
		}
		if disabledCalls.Load() != 0 {
			t.Fatalf("disabled upstream search should not be called, got %d", disabledCalls.Load())
		}
	})
}
