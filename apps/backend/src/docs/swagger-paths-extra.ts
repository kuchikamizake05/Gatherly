// Dibuat otomatis oleh scripts/generate-swagger-extra.mjs dari docs/api-contract.md. Jangan disunting manual.
export const extraTags = [
  {
    "name": "System"
  },
  {
    "name": "Organizer Events"
  },
  {
    "name": "Account"
  },
  {
    "name": "Organizer Applications"
  },
  {
    "name": "Workspace Auth"
  },
  {
    "name": "Organizer Workspace"
  },
  {
    "name": "Organizer Payouts"
  },
  {
    "name": "Refunds"
  },
  {
    "name": "Admin Auth"
  },
  {
    "name": "Admin Organizers"
  },
  {
    "name": "Admin Finance"
  },
  {
    "name": "Admin Reports"
  },
  {
    "name": "Orders"
  },
  {
    "name": "Tickets"
  },
  {
    "name": "Saved Events"
  },
  {
    "name": "Organizers"
  },
  {
    "name": "Event Reports"
  }
];

export const extraPaths: Record<string, Record<string, unknown>> = {
  "/events": {
    "get": {
      "tags": [
        "System"
      ],
      "summary": "Katalog published belum ended",
      "description": "Input: q, city, category, from, to, minPrice, maxPrice, sort=date_asc atau price_asc, page, limit\n\nHasil: Katalog published belum ended; startingPrice dari tipe yang dapat dibeli sekarang, nullable bila tidak ada",
      "security": [
        {
          "cookieAuth": []
        }
      ],
      "responses": {
        "200": {
          "description": "Katalog published belum ended; startingPrice dari tipe yang dapat dibeli sekarang, nullable bila tidak ada"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/events/{slug}": {
    "get": {
      "tags": [
        "System"
      ],
      "summary": "Detail publik + jenis tiket, available, availabilityStatus",
      "description": "Input: —\n\nHasil: Detail publik + jenis tiket, available, availabilityStatus; draf → 404",
      "security": [
        {
          "cookieAuth": []
        }
      ],
      "parameters": [
        {
          "name": "slug",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "200": {
          "description": "Detail publik + jenis tiket, available, availabilityStatus; draf → 404"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/organizer/events/{id}/ticket-types/{typeId}": {
    "patch": {
      "tags": [
        "Organizer Events"
      ],
      "summary": "200",
      "description": "Input: Subset field tipe\n\nHasil: 200; kapasitas >= sold + reserved; typeId harus milik event",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        },
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        },
        {
          "name": "typeId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "200": {
          "description": "200; kapasitas >= sold + reserved; typeId harus milik event"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "Subset field tipe",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    },
    "delete": {
      "tags": [
        "Organizer Events"
      ],
      "summary": "204 hanya tipe tanpa order",
      "description": "Input: —\n\nHasil: 204 hanya tipe tanpa order; 409 bila sudah direferensikan",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        },
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        },
        {
          "name": "typeId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204 hanya tipe tanpa order; 409 bila sudah direferensikan"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/organizer/posters": {
    "post": {
      "tags": [
        "System"
      ],
      "summary": "201 assetId + url",
      "description": "Input: Multipart field file\n\nHasil: 201 assetId + url; JPEG/PNG/WebP, maksimum 5 MB; periksa isi, bukan ekstensi saja; organizer login",
      "security": [
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "responses": {
        "201": {
          "description": "201 assetId + url; JPEG/PNG/WebP, maksimum 5 MB; periksa isi, bukan ekstensi saja; organizer login"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "Multipart field file",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/organizer/events/{id}/orders/{orderId}": {
    "get": {
      "tags": [
        "Organizer Events"
      ],
      "summary": "Detail pesanan dan timeline aman",
      "description": "Input: —\n\nHasil: Detail pesanan dan timeline aman; event dan order harus cocok serta milik organizer",
      "security": [
        {
          "workspaceCookie": []
        },
        {
          "cookieAuth": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        },
        {
          "name": "orderId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "200": {
          "description": "Detail pesanan dan timeline aman; event dan order harus cocok serta milik organizer"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/organizer/events/{id}/committee/{userId}": {
    "delete": {
      "tags": [
        "Organizer Events"
      ],
      "summary": "204",
      "description": "Input: —\n\nHasil: 204; cabut akses pada request berikut",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        },
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        },
        {
          "name": "userId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204; cabut akses pada request berikut"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/committee/events": {
    "get": {
      "tags": [
        "System"
      ],
      "summary": "Hanya acara ditugaskan",
      "description": "Input: page, limit\n\nHasil: Hanya acara ditugaskan",
      "security": [
        {
          "cookieAuth": []
        }
      ],
      "responses": {
        "200": {
          "description": "Hanya acara ditugaskan"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/account": {
    "get": {
      "tags": [
        "Account"
      ],
      "summary": "200 name, email, phone, avatarUrl, joinedAt, passwordChangedAt, hasPassword, googleEmail, activeDevices, notifications {",
      "description": "Input: —\n\nHasil: 200 name, email, phone, avatarUrl, joinedAt, passwordChangedAt, hasPassword, googleEmail, activeDevices, notifications {reminders, recommendations}",
      "security": [
        {
          "cookieAuth": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 name, email, phone, avatarUrl, joinedAt, passwordChangedAt, hasPassword, googleEmail, activeDevices, notifications {reminders, recommendations}"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    },
    "patch": {
      "tags": [
        "Account"
      ],
      "summary": "200 data akun terbaru",
      "description": "Input: name 2–100, phone nullable (7–25 karakter angka, spasi, +()-)\n\nHasil: 200 data akun terbaru. Kedua field wajib dikirim, field lain ditolak",
      "security": [
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 data akun terbaru. Kedua field wajib dikirim, field lain ditolak"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "name 2–100, phone nullable (7–25 karakter angka, spasi, +()-)",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/account/avatar": {
    "post": {
      "tags": [
        "Account"
      ],
      "summary": "200 {avatarUrl}",
      "description": "Input: Multipart field file\n\nHasil: 200 {avatarUrl}. JPEG/PNG/WebP maksimum 1 MB, isi berkas diperiksa",
      "security": [
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 {avatarUrl}. JPEG/PNG/WebP maksimum 1 MB, isi berkas diperiksa"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "Multipart field file",
        "content": {
          "multipart/form-data": {
            "schema": {
              "type": "object",
              "properties": {
                "file": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        }
      }
    }
  },
  "/account/password": {
    "post": {
      "tags": [
        "Account"
      ],
      "summary": "204",
      "description": "Input: currentPassword?, newPassword 12–128\n\nHasil: 204. currentPassword wajib bila akun sudah punya kata sandi. Sesi lain dicabut. Salah → 400 INVALID_PASSWORD, lima kali salah → 429 PASSWORD_LOCKED selama 10 menit, sama dengan lama → 400 PASSWORD_REUSED",
      "security": [
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "responses": {
        "204": {
          "description": "204. currentPassword wajib bila akun sudah punya kata sandi. Sesi lain dicabut. Salah → 400 INVALID_PASSWORD, lima kali salah → 429 PASSWORD_LOCKED selama 10 menit, sama dengan lama → 400 PASSWORD_REUSED"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "currentPassword?, newPassword 12–128",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/account/google": {
    "delete": {
      "tags": [
        "Account"
      ],
      "summary": "204 memutus tautan Google",
      "description": "Input: —\n\nHasil: 204 memutus tautan Google. Akun tanpa kata sandi → 409 PASSWORD_REQUIRED",
      "security": [
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "responses": {
        "204": {
          "description": "204 memutus tautan Google. Akun tanpa kata sandi → 409 PASSWORD_REQUIRED"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/account/sessions/revoke-others": {
    "post": {
      "tags": [
        "Account"
      ],
      "summary": "200 {signedOut} jumlah sesi lain yang dihapus",
      "description": "Input: —\n\nHasil: 200 {signedOut} jumlah sesi lain yang dihapus",
      "security": [
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 {signedOut} jumlah sesi lain yang dihapus"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/account/notifications": {
    "patch": {
      "tags": [
        "Account"
      ],
      "summary": "204",
      "description": "Input: reminders, recommendations (boolean, keduanya wajib)\n\nHasil: 204",
      "security": [
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "responses": {
        "204": {
          "description": "204"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "reminders, recommendations (boolean, keduanya wajib)",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/account/delete": {
    "post": {
      "tags": [
        "Account"
      ],
      "summary": "204 dan cookie dihapus",
      "description": "Input: confirmation berisi \"hapus\" atau \"hapus akun\"\n\nHasil: 204 dan cookie dihapus. Data dianonimkan. Masih punya tiket/order aktif untuk acara mendatang → 409 ACCOUNT_HAS_ACTIVE_TICKETS, pemilik profil organizer → 409 ACCOUNT_IS_ORGANIZER",
      "security": [
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "responses": {
        "204": {
          "description": "204 dan cookie dihapus. Data dianonimkan. Masih punya tiket/order aktif untuk acara mendatang → 409 ACCOUNT_HAS_ACTIVE_TICKETS, pemilik profil organizer → 409 ACCOUNT_IS_ORGANIZER"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "confirmation berisi \"hapus\" atau \"hapus akun\"",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/auth/password/forgot": {
    "post": {
      "tags": [
        "Account"
      ],
      "summary": "204 selalu, tanpa membocorkan keberadaan akun",
      "description": "Input: email\n\nHasil: 204 selalu, tanpa membocorkan keberadaan akun. Tautan WEB_ORIGIN/reset-password?token= berlaku 30 menit, tautan lama tidak berlaku",
      "security": [],
      "responses": {
        "204": {
          "description": "204 selalu, tanpa membocorkan keberadaan akun. Tautan WEB_ORIGIN/reset-password?token= berlaku 30 menit, tautan lama tidak berlaku"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "email",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/auth/password/reset": {
    "post": {
      "tags": [
        "Account"
      ],
      "summary": "204",
      "description": "Input: token 32–256, password 12–128\n\nHasil: 204. Semua sesi dicabut. Token salah, kedaluwarsa, atau terpakai → 410 TOKEN_INVALID, kata sandi sama → 400 PASSWORD_REUSED",
      "security": [],
      "responses": {
        "204": {
          "description": "204. Semua sesi dicabut. Token salah, kedaluwarsa, atau terpakai → 410 TOKEN_INVALID, kata sandi sama → 400 PASSWORD_REUSED"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "token 32–256, password 12–128",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/organizer-applications/username": {
    "get": {
      "tags": [
        "Organizer Applications"
      ],
      "summary": "200 {available, suggestions}",
      "description": "Input: username (3–40, huruf kecil, angka, ._-)\n\nHasil: 200 {available, suggestions}. Nama cadangan dan username yang sudah dipakai dianggap tidak tersedia",
      "security": [],
      "responses": {
        "200": {
          "description": "200 {available, suggestions}. Nama cadangan dan username yang sudah dipakai dianggap tidak tersedia"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/organizer-applications/documents": {
    "post": {
      "tags": [
        "Organizer Applications"
      ],
      "summary": "201 {id, name, type, size} dan cookie upload",
      "description": "Input: Multipart field file\n\nHasil: 201 {id, name, type, size} dan cookie upload. JPEG/PNG/PDF, gambar maksimum 1 MB, PDF maksimum 2 MB. Tanpa berkas → 400 FILE_REQUIRED",
      "security": [],
      "responses": {
        "201": {
          "description": "201 {id, name, type, size} dan cookie upload. JPEG/PNG/PDF, gambar maksimum 1 MB, PDF maksimum 2 MB. Tanpa berkas → 400 FILE_REQUIRED"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "Multipart field file",
        "content": {
          "multipart/form-data": {
            "schema": {
              "type": "object",
              "properties": {
                "file": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        }
      }
    }
  },
  "/organizer-applications": {
    "post": {
      "tags": [
        "Organizer Applications"
      ],
      "summary": "201 {number, email}",
      "description": "Input: Lihat skema di bawah\n\nHasil: 201 {number, email}. Email verifikasi PIC dikirim, berlaku 24 jam",
      "security": [],
      "responses": {
        "201": {
          "description": "201 {number, email}. Email verifikasi PIC dikirim, berlaku 24 jam"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "Lihat skema di bawah",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/organizer-applications/verify-email": {
    "get": {
      "tags": [
        "Organizer Applications"
      ],
      "summary": "200 {number, verified: true, message}",
      "description": "Input: token\n\nHasil: 200 {number, verified: true, message}. Tautan salah atau kedaluwarsa → 410 VERIFICATION_EXPIRED",
      "security": [],
      "responses": {
        "200": {
          "description": "200 {number, verified: true, message}. Tautan salah atau kedaluwarsa → 410 VERIFICATION_EXPIRED"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/organizer-applications/lookup": {
    "post": {
      "tags": [
        "Organizer Applications"
      ],
      "summary": "200 data pengajuan dan cookie sesi perbaikan",
      "description": "Input: number, email\n\nHasil: 200 data pengajuan dan cookie sesi perbaikan. Tidak cocok → 404, status bukan needs_fix → 409 NOT_NEEDS_FIX, tenggat lewat → 410 FIX_EXPIRED",
      "security": [],
      "responses": {
        "200": {
          "description": "200 data pengajuan dan cookie sesi perbaikan. Tidak cocok → 404, status bukan needs_fix → 409 NOT_NEEDS_FIX, tenggat lewat → 410 FIX_EXPIRED"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "number, email",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/organizer-applications/{number}/fix": {
    "post": {
      "tags": [
        "Organizer Applications"
      ],
      "summary": "204, status menjadi fix_submitted",
      "description": "Input: Hanya field yang ditandai admin\n\nHasil: 204, status menjadi fix_submitted. Tanpa cookie → 401, sesi perbaikan habis → 410 FIX_EXPIRED, field tidak ditandai → 400 FIELD_NOT_FLAGGED, field bertanda tidak dikirim → 400 FIX_INCOMPLETE",
      "security": [],
      "parameters": [
        {
          "name": "number",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204, status menjadi fix_submitted. Tanpa cookie → 401, sesi perbaikan habis → 410 FIX_EXPIRED, field tidak ditandai → 400 FIELD_NOT_FLAGGED, field bertanda tidak dikirim → 400 FIX_INCOMPLETE"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "Hanya field yang ditandai admin",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/workspace/auth/login": {
    "post": {
      "tags": [
        "Workspace Auth"
      ],
      "summary": "200 {role, username, name, mustChangePassword, organizer {id, name, username, frozen, frozenReason}, csrfToken} dan cook",
      "description": "Input: username, password\n\nHasil: 200 {role, username, name, mustChangePassword, organizer {id, name, username, frozen, frozenReason}, csrfToken} dan cookie. Salah → 401 generik, lima kali salah → 429 ACCOUNT_LOCKED selama 10 menit, kata sandi sementara lewat 7 hari → 410 TEMPORARY_PASSWORD_EXPIRED",
      "security": [],
      "responses": {
        "200": {
          "description": "200 {role, username, name, mustChangePassword, organizer {id, name, username, frozen, frozenReason}, csrfToken} dan cookie. Salah → 401 generik, lima kali salah → 429 ACCOUNT_LOCKED selama 10 menit, kata sandi sementara lewat 7 hari → 410 TEMPORARY_PASSWORD_EXPIRED"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "username, password",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/workspace/auth/me": {
    "get": {
      "tags": [
        "Workspace Auth"
      ],
      "summary": "200 bentuk yang sama dengan login",
      "description": "Input: —\n\nHasil: 200 bentuk yang sama dengan login. Tanpa sesi → 401",
      "security": [
        {
          "workspaceCookie": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 bentuk yang sama dengan login. Tanpa sesi → 401"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/workspace/auth/logout": {
    "post": {
      "tags": [
        "Workspace Auth"
      ],
      "summary": "204, sesi dan cookie dihapus",
      "description": "Input: —\n\nHasil: 204, sesi dan cookie dihapus. Memerlukan CSRF",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        }
      ],
      "responses": {
        "204": {
          "description": "204, sesi dan cookie dihapus. Memerlukan CSRF"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/workspace/auth/password/first": {
    "post": {
      "tags": [
        "Workspace Auth"
      ],
      "summary": "204",
      "description": "Input: newPassword 12–128\n\nHasil: 204. Hanya saat mustChangePassword, selain itu 409 CONFLICT. Sama dengan sementara → 400 PASSWORD_REUSED. Sesi lain dicabut",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        }
      ],
      "responses": {
        "204": {
          "description": "204. Hanya saat mustChangePassword, selain itu 409 CONFLICT. Sama dengan sementara → 400 PASSWORD_REUSED. Sesi lain dicabut"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "newPassword 12–128",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/workspace/auth/password": {
    "post": {
      "tags": [
        "Workspace Auth"
      ],
      "summary": "204",
      "description": "Input: currentPassword, newPassword 12–128\n\nHasil: 204. Salah → 400 WRONG_PASSWORD. Sesi lain dicabut",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        }
      ],
      "responses": {
        "204": {
          "description": "204. Salah → 400 WRONG_PASSWORD. Sesi lain dicabut"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "currentPassword, newPassword 12–128",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/workspace/auth/password/forgot": {
    "post": {
      "tags": [
        "Workspace Auth"
      ],
      "summary": "200 {isCommittee}",
      "description": "Input: usernameOrEmail\n\nHasil: 200 {isCommittee}. Panitia mendapat true dan diarahkan menghubungi organizer. Selain itu selalu false. Organizer dengan email menerima tautan ORGANIZER_ORIGIN/reset-password?token= yang berlaku 30 menit",
      "security": [],
      "responses": {
        "200": {
          "description": "200 {isCommittee}. Panitia mendapat true dan diarahkan menghubungi organizer. Selain itu selalu false. Organizer dengan email menerima tautan ORGANIZER_ORIGIN/reset-password?token= yang berlaku 30 menit"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "usernameOrEmail",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/workspace/auth/password/reset": {
    "post": {
      "tags": [
        "Workspace Auth"
      ],
      "summary": "204, hanya akun organizer",
      "description": "Input: token (minimal 20), password 12–128\n\nHasil: 204, hanya akun organizer. Semua sesi dicabut. Token salah atau kedaluwarsa → 410 RESET_EXPIRED",
      "security": [],
      "responses": {
        "204": {
          "description": "204, hanya akun organizer. Semua sesi dicabut. Token salah atau kedaluwarsa → 410 RESET_EXPIRED"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "token (minimal 20), password 12–128",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/organizer/profile": {
    "get": {
      "tags": [
        "Organizer Workspace"
      ],
      "summary": "200 name, username, city, description, logoUrl, links",
      "description": "Input: —\n\nHasil: 200 name, username, city, description, logoUrl, links",
      "security": [
        {
          "workspaceCookie": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 name, username, city, description, logoUrl, links"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    },
    "patch": {
      "tags": [
        "Organizer Workspace"
      ],
      "summary": "204",
      "description": "Input: Multipart atau JSON. name 2–150, city 1–100, description 10–2.000, links maksimum 5 {type 1–30, url 3–500}, file logo opsional\n\nHasil: 204. Semua field teks wajib. Dalam multipart links dikirim sebagai string JSON. Logo JPEG/PNG/WebP maksimum 1 MB, selain itu 400 INVALID_IMAGE",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        }
      ],
      "responses": {
        "204": {
          "description": "204. Semua field teks wajib. Dalam multipart links dikirim sebagai string JSON. Logo JPEG/PNG/WebP maksimum 1 MB, selain itu 400 INVALID_IMAGE"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "Multipart atau JSON. name 2–150, city 1–100, description 10–2.000, links maksimum 5 {type 1–30, url 3–500}, file logo opsional",
        "content": {
          "multipart/form-data": {
            "schema": {
              "type": "object",
              "properties": {
                "file": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        }
      }
    }
  },
  "/organizer/team": {
    "get": {
      "tags": [
        "Organizer Workspace"
      ],
      "summary": "200 array",
      "description": "Input: —\n\nHasil: 200 array. Baris pertama pemilik dengan status owner dan assignedEvents -1. Anggota berisi id, name, username, assignedEvents, eventIds, status active/inactive/never_logged_in",
      "security": [
        {
          "workspaceCookie": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 array. Baris pertama pemilik dengan status owner dan assignedEvents -1. Anggota berisi id, name, username, assignedEvents, eventIds, status active/inactive/never_logged_in"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    },
    "post": {
      "tags": [
        "Organizer Workspace"
      ],
      "summary": "201 {username, temporaryPassword, expiresAt}",
      "description": "Input: name 1–100, username, eventIds maksimum 100\n\nHasil: 201 {username, temporaryPassword, expiresAt}. Kata sandi sementara hanya tampil sekali dan berlaku 7 hari. Username terpakai → 409 USERNAME_TAKEN, lebih dari 100 anggota → 409 MEMBER_LIMIT, acara bukan milik organizer → 400 INVALID_EVENTS",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        }
      ],
      "responses": {
        "201": {
          "description": "201 {username, temporaryPassword, expiresAt}. Kata sandi sementara hanya tampil sekali dan berlaku 7 hari. Username terpakai → 409 USERNAME_TAKEN, lebih dari 100 anggota → 409 MEMBER_LIMIT, acara bukan milik organizer → 400 INVALID_EVENTS"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "name 1–100, username, eventIds maksimum 100",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/organizer/team/username": {
    "get": {
      "tags": [
        "Organizer Workspace"
      ],
      "summary": "200 {available}",
      "description": "Input: username\n\nHasil: 200 {available}",
      "security": [
        {
          "workspaceCookie": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 {available}"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/organizer/team/{id}/assignments": {
    "put": {
      "tags": [
        "Organizer Workspace"
      ],
      "summary": "204, mengganti seluruh penugasan",
      "description": "Input: eventIds maksimum 100\n\nHasil: 204, mengganti seluruh penugasan. Acara harus milik organizer",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204, mengganti seluruh penugasan. Acara harus milik organizer"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "eventIds maksimum 100",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/organizer/team/{id}/reset-password": {
    "post": {
      "tags": [
        "Organizer Workspace"
      ],
      "summary": "200 {username, temporaryPassword, expiresAt}",
      "description": "Input: —\n\nHasil: 200 {username, temporaryPassword, expiresAt}. Sesi anggota dicabut",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "200": {
          "description": "200 {username, temporaryPassword, expiresAt}. Sesi anggota dicabut"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/organizer/team/{id}/deactivate": {
    "post": {
      "tags": [
        "Organizer Workspace"
      ],
      "summary": "204",
      "description": "Input: —\n\nHasil: 204. Sesi anggota dicabut dan login ditolak",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204. Sesi anggota dicabut dan login ditolak"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/organizer/team/{id}/reactivate": {
    "post": {
      "tags": [
        "Organizer Workspace"
      ],
      "summary": "204",
      "description": "Input: —\n\nHasil: 204",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/organizer/team/{id}": {
    "delete": {
      "tags": [
        "Organizer Workspace"
      ],
      "summary": "204",
      "description": "Input: —\n\nHasil: 204. Sesi dan penugasan anggota ikut dihapus",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204. Sesi dan penugasan anggota ikut dihapus"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/organizer/bank-account": {
    "get": {
      "tags": [
        "Organizer Payouts"
      ],
      "summary": "200 {bank, accountNumber tersamar ••••1234, holderName} atau null",
      "description": "Input: —\n\nHasil: 200 {bank, accountNumber tersamar ••••1234, holderName} atau null",
      "security": [
        {
          "workspaceCookie": []
        },
        {
          "cookieAuth": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 {bank, accountNumber tersamar ••••1234, holderName} atau null"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    },
    "put": {
      "tags": [
        "Organizer Payouts"
      ],
      "summary": "200 data tersamar",
      "description": "Input: bank 2–80, accountNumber 5–30 digit, holderName 2–100\n\nHasil: 200 data tersamar. Membuat atau mengganti rekening",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        },
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 data tersamar. Membuat atau mengganti rekening"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "bank 2–80, accountNumber 5–30 digit, holderName 2–100",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/organizer/payouts": {
    "get": {
      "tags": [
        "Organizer Payouts"
      ],
      "summary": "200 {available, processing, transferred, rows}",
      "description": "Input: —\n\nHasil: 200 {available, processing, transferred, rows}. rows berisi eventId, eventTitle, eventDate, net, status waiting_event/available/requested/transferred, requestedAt, transferredAt, transferReference",
      "security": [
        {
          "workspaceCookie": []
        },
        {
          "cookieAuth": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 {available, processing, transferred, rows}. rows berisi eventId, eventTitle, eventDate, net, status waiting_event/available/requested/transferred, requestedAt, transferredAt, transferReference"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    },
    "post": {
      "tags": [
        "Organizer Payouts"
      ],
      "summary": "201 {eventId, status: \"requested\"}",
      "description": "Input: eventId\n\nHasil: 201 {eventId, status: \"requested\"}",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        },
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "responses": {
        "201": {
          "description": "201 {eventId, status: \"requested\"}"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "eventId",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/organizer/events/{id}/duplicate": {
    "post": {
      "tags": [
        "Organizer Events"
      ],
      "summary": "201 {id}",
      "description": "Input: —\n\nHasil: 201 {id}. Salinan draf berjudul \"(salinan)\" beserta tipe tiket dengan counter nol. Status pembatalan tidak ikut disalin",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        },
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "201": {
          "description": "201 {id}. Salinan draf berjudul \"(salinan)\" beserta tipe tiket dengan counter nol. Status pembatalan tidak ikut disalin"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/organizer/events/{id}/cancel": {
    "post": {
      "tags": [
        "Organizer Events"
      ],
      "summary": "201 {id, status: \"requested\"}, menunggu keputusan admin",
      "description": "Input: confirmTitle sama persis dengan judul, reason 10–1.000\n\nHasil: 201 {id, status: \"requested\"}, menunggu keputusan admin. Judul tidak cocok → 400 CONFIRMATION_MISMATCH, sudah dibatalkan atau diajukan → 409 CANCELLATION_EXISTS, acara selesai → 409 EVENT_ENDED",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        },
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "201": {
          "description": "201 {id, status: \"requested\"}, menunggu keputusan admin. Judul tidak cocok → 400 CONFIRMATION_MISMATCH, sudah dibatalkan atau diajukan → 409 CANCELLATION_EXISTS, acara selesai → 409 EVENT_ENDED"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "confirmTitle sama persis dengan judul, reason 10–1.000",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/organizer/events/{id}/ticket-types/{typeId}/stop": {
    "post": {
      "tags": [
        "Organizer Events"
      ],
      "summary": "204, penjualan tipe dihentikan sementara (salesStopped)",
      "description": "Input: —\n\nHasil: 204, penjualan tipe dihentikan sementara (salesStopped)",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        },
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        },
        {
          "name": "typeId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204, penjualan tipe dihentikan sementara (salesStopped)"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/organizer/events/{id}/ticket-types/{typeId}/resume": {
    "post": {
      "tags": [
        "Organizer Events"
      ],
      "summary": "204, penjualan tipe dibuka kembali",
      "description": "Input: —\n\nHasil: 204, penjualan tipe dibuka kembali",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        },
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        },
        {
          "name": "typeId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204, penjualan tipe dibuka kembali"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/organizer/events/{id}/orders/{orderId}/refunds": {
    "post": {
      "tags": [
        "Organizer Events"
      ],
      "summary": "201 refund kind organizer berstatus approved",
      "description": "Input: mode full/partial, ticketIds? maksimum 20, reason 3–500\n\nHasil: 201 refund kind organizer berstatus approved. Lihat bagian pengembalian dana",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        },
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        },
        {
          "name": "orderId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "201": {
          "description": "201 refund kind organizer berstatus approved. Lihat bagian pengembalian dana"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "mode full/partial, ticketIds? maksimum 20, reason 3–500",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/organizer/events/{id}/orders/{orderId}/resend": {
    "post": {
      "tags": [
        "Organizer Events"
      ],
      "summary": "202 {queued: true}, email tiket dikirim ulang ke pembeli",
      "description": "Input: —\n\nHasil: 202 {queued: true}, email tiket dikirim ulang ke pembeli. Hanya order paid dan issued, jeda 60 detik per order, selain itu 409 RESEND_UNAVAILABLE",
      "security": [
        {
          "workspaceCookie": [],
          "csrfToken": []
        },
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        },
        {
          "name": "orderId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "202": {
          "description": "202 {queued: true}, email tiket dikirim ulang ke pembeli. Hanya order paid dan issued, jeda 60 detik per order, selain itu 409 RESEND_UNAVAILABLE"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/refunds": {
    "get": {
      "tags": [
        "Refunds"
      ],
      "summary": "200 maksimal 100 refund milik pembeli, terbaru dulu, tanpa meta",
      "description": "Input: —\n\nHasil: 200 maksimal 100 refund milik pembeli, terbaru dulu, tanpa meta. Sesi peserta",
      "security": [
        {
          "cookieAuth": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 maksimal 100 refund milik pembeli, terbaru dulu, tanpa meta. Sesi peserta"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/refunds/orders/{orderId}": {
    "post": {
      "tags": [
        "Refunds"
      ],
      "summary": "201 refund kind buyer berstatus requested",
      "description": "Input: reason 10–1.000, ticketIds? 1–4\n\nHasil: 201 refund kind buyer berstatus requested. Sesi peserta dan CSRF. Tanpa ticketIds semua tiket unused diajukan",
      "security": [
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "orderId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "201": {
          "description": "201 refund kind buyer berstatus requested. Sesi peserta dan CSRF. Tanpa ticketIds semua tiket unused diajukan"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "reason 10–1.000, ticketIds? 1–4",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/admin/auth/login": {
    "post": {
      "tags": [
        "Admin Auth"
      ],
      "summary": "200 {challengeId}",
      "description": "Input: email, password\n\nHasil: 200 {challengeId}. Challenge berlaku 5 menit dan maksimal lima percobaan. Salah → 401 generik, lima kali salah → 429 ACCOUNT_LOCKED selama 10 menit",
      "security": [],
      "responses": {
        "200": {
          "description": "200 {challengeId}. Challenge berlaku 5 menit dan maksimal lima percobaan. Salah → 401 generik, lima kali salah → 429 ACCOUNT_LOCKED selama 10 menit"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "email, password",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/admin/auth/totp": {
    "post": {
      "tags": [
        "Admin Auth"
      ],
      "summary": "200 {id, name, email, csrfToken} dan cookie",
      "description": "Input: challengeId, code, rememberDevice?\n\nHasil: 200 {id, name, email, csrfToken} dan cookie. Sesi 8 jam, atau 7 hari bila rememberDevice. Kode TOTP tidak dapat dipakai ulang",
      "security": [],
      "responses": {
        "200": {
          "description": "200 {id, name, email, csrfToken} dan cookie. Sesi 8 jam, atau 7 hari bila rememberDevice. Kode TOTP tidak dapat dipakai ulang"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "challengeId, code, rememberDevice?",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/admin/auth/backup-code": {
    "post": {
      "tags": [
        "Admin Auth"
      ],
      "summary": "Sama dengan totp",
      "description": "Input: challengeId, code, rememberDevice?\n\nHasil: Sama dengan totp. Kode cadangan sekali pakai dan admin utama menerima email pemberitahuan",
      "security": [],
      "responses": {
        "200": {
          "description": "Sama dengan totp. Kode cadangan sekali pakai dan admin utama menerima email pemberitahuan"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "challengeId, code, rememberDevice?",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/admin/auth/me": {
    "get": {
      "tags": [
        "Admin Auth"
      ],
      "summary": "200 {id, name, email, csrfToken}",
      "description": "Input: —\n\nHasil: 200 {id, name, email, csrfToken}. Tanpa sesi → 401",
      "security": [
        {
          "adminCookie": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 {id, name, email, csrfToken}. Tanpa sesi → 401"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/admin/auth/logout": {
    "post": {
      "tags": [
        "Admin Auth"
      ],
      "summary": "204, sesi dan cookie dihapus",
      "description": "Input: —\n\nHasil: 204, sesi dan cookie dihapus",
      "security": [
        {
          "adminCookie": [],
          "csrfToken": []
        }
      ],
      "responses": {
        "204": {
          "description": "204, sesi dan cookie dihapus"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/admin/applications": {
    "get": {
      "tags": [
        "Admin Organizers"
      ],
      "summary": "200 data {id, number, organizerName, type, submittedAt, status}, meta, counts {new, needs_fix, approved, rejected}",
      "description": "Input: page, q (nama atau nomor), tab (status, new mencakup fix_submitted), type\n\nHasil: 200 data {id, number, organizerName, type, submittedAt, status}, meta, counts {new, needs_fix, approved, rejected}",
      "security": [
        {
          "adminCookie": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 data {id, number, organizerName, type, submittedAt, status}, meta, counts {new, needs_fix, approved, rejected}"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/admin/applications.csv": {
    "get": {
      "tags": [
        "Admin Organizers"
      ],
      "summary": "200 text/csv lampiran, maksimal 10",
      "description": "Input: —\n\nHasil: 200 text/csv lampiran, maksimal 10.000 baris. Sel diawali = + @ - dinetralkan",
      "security": [
        {
          "adminCookie": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 text/csv lampiran, maksimal 10.000 baris. Sel diawali = + @ - dinetralkan"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/admin/applications/{id}": {
    "get": {
      "tags": [
        "Admin Organizers"
      ],
      "summary": "200 data pengajuan, documents (URL bertanda tangan), checks {emailVerified, usernameAvailable, similarOrganizers}, histo",
      "description": "Input: —\n\nHasil: 200 data pengajuan, documents (URL bertanda tangan), checks {emailVerified, usernameAvailable, similarOrganizers}, history. Akses dokumen dicatat di audit log",
      "security": [
        {
          "adminCookie": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "200": {
          "description": "200 data pengajuan, documents (URL bertanda tangan), checks {emailVerified, usernameAvailable, similarOrganizers}, history. Akses dokumen dicatat di audit log"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/admin/applications/{id}/request-fix": {
    "post": {
      "tags": [
        "Admin Organizers"
      ],
      "summary": "204, status needs_fix dengan tenggat 14 hari, email dikirim ke PIC",
      "description": "Input: flags 1–10 {field, note 1–1.000}\n\nHasil: 204, status needs_fix dengan tenggat 14 hari, email dikirim ke PIC",
      "security": [
        {
          "adminCookie": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204, status needs_fix dengan tenggat 14 hari, email dikirim ke PIC"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "flags 1–10 {field, note 1–1.000}",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/admin/applications/{id}/reject": {
    "post": {
      "tags": [
        "Admin Organizers"
      ],
      "summary": "204, email penolakan dikirim",
      "description": "Input: reason 5–2.000\n\nHasil: 204, email penolakan dikirim. Dokumen dihapus setelah 90 hari",
      "security": [
        {
          "adminCookie": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204, email penolakan dikirim. Dokumen dihapus setelah 90 hari"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "reason 5–2.000",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/admin/applications/{id}/approve": {
    "post": {
      "tags": [
        "Admin Organizers"
      ],
      "summary": "204",
      "description": "Input: —\n\nHasil: 204. Membuat organizer dan akun workspace, lalu mengirim username serta kata sandi sementara 7 hari ke PIC. Email belum diverifikasi → 409 EMAIL_NOT_VERIFIED, flag belum diselesaikan → 409 FLAGS_EXIST, username terpakai → 409 USERNAME_TAKEN",
      "security": [
        {
          "adminCookie": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204. Membuat organizer dan akun workspace, lalu mengirim username serta kata sandi sementara 7 hari ke PIC. Email belum diverifikasi → 409 EMAIL_NOT_VERIFIED, flag belum diselesaikan → 409 FLAGS_EXIST, username terpakai → 409 USERNAME_TAKEN"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/admin/organizers": {
    "get": {
      "tags": [
        "Admin Organizers"
      ],
      "summary": "200 data {id, name, username, status, activeEvents, grossSales}, meta, counts {active, never_logged_in, frozen}",
      "description": "Input: page, q (nama, username, email), tab (active/never_logged_in/frozen)\n\nHasil: 200 data {id, name, username, status, activeEvents, grossSales}, meta, counts {active, never_logged_in, frozen}",
      "security": [
        {
          "adminCookie": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 data {id, name, username, status, activeEvents, grossSales}, meta, counts {active, never_logged_in, frozen}"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/admin/organizers/{id}": {
    "get": {
      "tags": [
        "Admin Organizers"
      ],
      "summary": "200 ringkasan organizer, events {id, title, startsAt, sold, capacity, status}, joinedAt, applicationNumber, totalEvents,",
      "description": "Input: —\n\nHasil: 200 ringkasan organizer, events {id, title, startsAt, sold, capacity, status}, joinedAt, applicationNumber, totalEvents, completedEvents, pic, frozenReason, activity, reportCount",
      "security": [
        {
          "adminCookie": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "200": {
          "description": "200 ringkasan organizer, events {id, title, startsAt, sold, capacity, status}, joinedAt, applicationNumber, totalEvents, completedEvents, pic, frozenReason, activity, reportCount"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/admin/organizers/{id}/freeze": {
    "post": {
      "tags": [
        "Admin Organizers"
      ],
      "summary": "204",
      "description": "Input: reason 5–2.000\n\nHasil: 204. Semua mutasi organizer ditolak dan acaranya tampil tertutup di katalog",
      "security": [
        {
          "adminCookie": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204. Semua mutasi organizer ditolak dan acaranya tampil tertutup di katalog"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "reason 5–2.000",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/admin/organizers/{id}/unfreeze": {
    "post": {
      "tags": [
        "Admin Organizers"
      ],
      "summary": "204, status kembali active atau never_logged_in",
      "description": "Input: —\n\nHasil: 204, status kembali active atau never_logged_in",
      "security": [
        {
          "adminCookie": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204, status kembali active atau never_logged_in"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/admin/organizers/{id}/resend-access": {
    "post": {
      "tags": [
        "Admin Organizers"
      ],
      "summary": "204, kata sandi sementara baru dikirim ke email kontak",
      "description": "Input: —\n\nHasil: 204, kata sandi sementara baru dikirim ke email kontak. Sudah pernah login → 409 ALREADY_LOGGED_IN",
      "security": [
        {
          "adminCookie": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204, kata sandi sementara baru dikirim ke email kontak. Sudah pernah login → 409 ALREADY_LOGGED_IN"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/admin/refunds": {
    "get": {
      "tags": [
        "Admin Finance"
      ],
      "summary": "200 maksimal 100 refund terbaru dengan eventTitle, orderCode, buyerName",
      "description": "Input: status?\n\nHasil: 200 maksimal 100 refund terbaru dengan eventTitle, orderCode, buyerName",
      "security": [
        {
          "adminCookie": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 maksimal 100 refund terbaru dengan eventTitle, orderCode, buyerName"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/admin/refunds/{id}/decision": {
    "post": {
      "tags": [
        "Admin Finance"
      ],
      "summary": "200 refund",
      "description": "Input: approve (boolean), note 3–1.000\n\nHasil: 200 refund. Hanya status requested, selain itu 409 ALREADY_REVIEWED. Disetujui membatalkan tiket terkait, sudah ada pencairan → 409 PAYOUT_EXISTS. Pembeli menerima email",
      "security": [
        {
          "adminCookie": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "200": {
          "description": "200 refund. Hanya status requested, selain itu 409 ALREADY_REVIEWED. Disetujui membatalkan tiket terkait, sudah ada pencairan → 409 PAYOUT_EXISTS. Pembeli menerima email"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "approve (boolean), note 3–1.000",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/admin/refunds/{id}/transferred": {
    "post": {
      "tags": [
        "Admin Finance"
      ],
      "summary": "204, refund menjadi refunded",
      "description": "Input: transferReference 3–200, transferredAt (tidak di masa depan)\n\nHasil: 204, refund menjadi refunded. Hanya status manual_required, selain itu 409 NOT_MANUAL",
      "security": [
        {
          "adminCookie": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204, refund menjadi refunded. Hanya status manual_required, selain itu 409 NOT_MANUAL"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "transferReference 3–200, transferredAt (tidak di masa depan)",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/admin/cancellations": {
    "get": {
      "tags": [
        "Admin Finance"
      ],
      "summary": "200 acara dengan pengajuan batal {id, title, organizerId, organizerName, reason, requestedAt}, terlama dulu",
      "description": "Input: —\n\nHasil: 200 acara dengan pengajuan batal {id, title, organizerId, organizerName, reason, requestedAt}, terlama dulu",
      "security": [
        {
          "adminCookie": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 acara dengan pengajuan batal {id, title, organizerId, organizerName, reason, requestedAt}, terlama dulu"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/admin/cancellations/{id}/decision": {
    "post": {
      "tags": [
        "Admin Finance"
      ],
      "summary": "200 {id, status}",
      "description": "Input: approve, note 3–1.000\n\nHasil: 200 {id, status}. Disetujui membuat acara cancelled, menutup penjualan, dan membuat refund penuh. Tidak ada pengajuan → 409 NOT_REQUESTED, sudah ada pencairan → 409 PAYOUT_EXISTS",
      "security": [
        {
          "adminCookie": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "200": {
          "description": "200 {id, status}. Disetujui membuat acara cancelled, menutup penjualan, dan membuat refund penuh. Tidak ada pengajuan → 409 NOT_REQUESTED, sudah ada pencairan → 409 PAYOUT_EXISTS"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "approve, note 3–1.000",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/admin/payouts": {
    "get": {
      "tags": [
        "Admin Finance"
      ],
      "summary": "200 data {id, eventId, eventTitle, organizerName, amount, net, bank, accountNumber, holderName, status, requestedAt, tra",
      "description": "Input: tab requested/transferred, page, limit 1–100\n\nHasil: 200 data {id, eventId, eventTitle, organizerName, amount, net, bank, accountNumber, holderName, status, requestedAt, transferredAt, transferReference}, meta, counts",
      "security": [
        {
          "adminCookie": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 data {id, eventId, eventTitle, organizerName, amount, net, bank, accountNumber, holderName, status, requestedAt, transferredAt, transferReference}, meta, counts"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/admin/payouts/{id}/transferred": {
    "post": {
      "tags": [
        "Admin Finance"
      ],
      "summary": "204, organizer menerima email",
      "description": "Input: transferReference 3–200, transferredAt\n\nHasil: 204, organizer menerima email. Sudah ditransfer → 409 ALREADY_TRANSFERRED, refund belum selesai → 409 REFUNDS_PENDING, tanggal sebelum pengajuan → 400",
      "security": [
        {
          "adminCookie": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204, organizer menerima email. Sudah ditransfer → 409 ALREADY_TRANSFERRED, refund belum selesai → 409 REFUNDS_PENDING, tanggal sebelum pengajuan → 400"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "transferReference 3–200, transferredAt",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/admin/reports": {
    "get": {
      "tags": [
        "Admin Reports"
      ],
      "summary": "200 data {id, eventTitle, organizerName, reason, createdAt, status}, meta, counts {new, done}",
      "description": "Input: tab new/done, page, limit 1–100\n\nHasil: 200 data {id, eventTitle, organizerName, reason, createdAt, status}, meta, counts {new, done}",
      "security": [
        {
          "adminCookie": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 data {id, eventTitle, organizerName, reason, createdAt, status}, meta, counts {new, done}"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/admin/reports/{id}": {
    "get": {
      "tags": [
        "Admin Reports"
      ],
      "summary": "200 detail laporan, reporter {email, isTicketHolder}, event {slug, title, startsAt, soldLabel}, organizer {id, name, use",
      "description": "Input: —\n\nHasil: 200 detail laporan, reporter {email, isTicketHolder}, event {slug, title, startsAt, soldLabel}, organizer {id, name, username, recentReports}",
      "security": [
        {
          "adminCookie": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "200": {
          "description": "200 detail laporan, reporter {email, isTicketHolder}, event {slug, title, startsAt, soldLabel}, organizer {id, name, username, recentReports}"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/admin/reports/{id}/close": {
    "post": {
      "tags": [
        "Admin Reports"
      ],
      "summary": "204, pelapor menerima email",
      "description": "Input: note 1–2.000\n\nHasil: 204, pelapor menerima email. Sudah ditutup → 409 REPORT_ALREADY_CLOSED",
      "security": [
        {
          "adminCookie": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204, pelapor menerima email. Sudah ditutup → 409 REPORT_ALREADY_CLOSED"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "note 1–2.000",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/orders/{id}/cancel": {
    "post": {
      "tags": [
        "Orders"
      ],
      "summary": "204",
      "description": "Input: —\n\nHasil: 204. Sesi peserta dan CSRF. Hanya order pending dengan reservasi held, selain itu 409 NOT_CANCELLABLE. Order yang sudah dibatalkan tetap 204",
      "security": [
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204. Sesi peserta dan CSRF. Hanya order pending dengan reservasi held, selain itu 409 NOT_CANCELLABLE. Order yang sudah dibatalkan tetap 204"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/orders/{orderId}/tickets/resend": {
    "post": {
      "tags": [
        "Orders"
      ],
      "summary": "204, email tiket dikirim ulang ke pembeli",
      "description": "Input: —\n\nHasil: 204, email tiket dikirim ulang ke pembeli. Hanya order issued milik sendiri, jeda 60 detik, selain itu 409 RESEND_UNAVAILABLE",
      "security": [
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "orderId",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204, email tiket dikirim ulang ke pembeli. Hanya order issued milik sendiri, jeda 60 detik, selain itu 409 RESEND_UNAVAILABLE"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/tickets/shared/{token}": {
    "get": {
      "tags": [
        "Tickets"
      ],
      "summary": "200 detail tiket beserta qrPayload",
      "description": "Input: —\n\nHasil: 200 detail tiket beserta qrPayload. Publik, token adalah qrToken 43 karakter. Respons no-store dan no-referrer. Token salah → 404",
      "security": [],
      "parameters": [
        {
          "name": "token",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "200": {
          "description": "200 detail tiket beserta qrPayload. Publik, token adalah qrToken 43 karakter. Respons no-store dan no-referrer. Token salah → 404"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/me/saved-events": {
    "get": {
      "tags": [
        "Saved Events"
      ],
      "summary": "200 kartu acara tersimpan {slug, title, category, startsAt, venueName, poster, startingPrice, saved, status, highlight?}",
      "description": "Input: page, limit 1–100\n\nHasil: 200 kartu acara tersimpan {slug, title, category, startsAt, venueName, poster, startingPrice, saved, status, highlight?} dan meta. Acara mendatang lebih dulu. Sesi peserta",
      "security": [
        {
          "cookieAuth": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 kartu acara tersimpan {slug, title, category, startsAt, venueName, poster, startingPrice, saved, status, highlight?} dan meta. Acara mendatang lebih dulu. Sesi peserta"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/me/saved-events/{slug}": {
    "put": {
      "tags": [
        "Saved Events"
      ],
      "summary": "204, idempoten",
      "description": "Input: —\n\nHasil: 204, idempoten. Hanya acara published, selain itu 404. CSRF",
      "security": [
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "slug",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204, idempoten. Hanya acara published, selain itu 404. CSRF"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    },
    "delete": {
      "tags": [
        "Saved Events"
      ],
      "summary": "204, idempoten",
      "description": "Input: —\n\nHasil: 204, idempoten. CSRF",
      "security": [
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "slug",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "204": {
          "description": "204, idempoten. CSRF"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/organizers/{username}/profile": {
    "get": {
      "tags": [
        "Organizers"
      ],
      "summary": "200 username, name, city, since, description, links, eventCount, upcoming, past",
      "description": "Input: —\n\nHasil: 200 username, name, city, since, description, links, eventCount, upcoming, past. Publik, hanya acara published",
      "security": [],
      "parameters": [
        {
          "name": "username",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "200": {
          "description": "200 username, name, city, since, description, links, eventCount, upcoming, past. Publik, hanya acara published"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/events/{slug}/reports": {
    "post": {
      "tags": [
        "Event Reports"
      ],
      "summary": "201 {submitted: true}",
      "description": "Input: reason fraud/wrong_info/inappropriate/other, note maksimum 1.000\n\nHasil: 201 {submitted: true}. Sesi peserta dan CSRF. reason other memerlukan note minimal 10 karakter. Acara harus published atau cancelled. Laporan terbuka yang sama dari pengguna yang sama → 409 REPORT_EXISTS",
      "security": [
        {
          "cookieAuth": [],
          "csrfToken": []
        }
      ],
      "parameters": [
        {
          "name": "slug",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "201": {
          "description": "201 {submitted: true}. Sesi peserta dan CSRF. reason other memerlukan note minimal 10 karakter. Acara harus published atau cancelled. Laporan terbuka yang sama dari pengguna yang sama → 409 REPORT_EXISTS"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      },
      "requestBody": {
        "required": true,
        "description": "reason fraud/wrong_info/inappropriate/other, note maksimum 1.000",
        "content": {
          "application/json": {
            "schema": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "/media/{id}": {
    "get": {
      "tags": [
        "System"
      ],
      "summary": "302 ke URL bertanda tangan",
      "description": "Input: —\n\nHasil: 302 ke URL bertanda tangan. Publik, hanya aset non-privat, Cache-Control private max-age=60. Aset tidak ada → 404",
      "security": [],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "responses": {
        "302": {
          "description": "302 ke URL bertanda tangan. Publik, hanya aset non-privat, Cache-Control private max-age=60. Aset tidak ada → 404"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  },
  "/realtime/ticket": {
    "post": {
      "tags": [
        "System"
      ],
      "summary": "200 {token}",
      "description": "Input: —\n\nHasil: 200 {token}. Sesi peserta atau workspace dengan CSRF. Token sekali pakai berlaku 30 detik untuk handshake socket lewat query ticket",
      "security": [
        {
          "cookieAuth": [],
          "csrfToken": []
        },
        {
          "workspaceCookie": [],
          "csrfToken": []
        }
      ],
      "responses": {
        "200": {
          "description": "200 {token}. Sesi peserta atau workspace dengan CSRF. Token sekali pakai berlaku 30 detik untuk handshake socket lewat query ticket"
        },
        "default": {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ErrorResponse"
              }
            }
          }
        }
      }
    }
  }
};
