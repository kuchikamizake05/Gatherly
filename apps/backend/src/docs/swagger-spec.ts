export const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "Gatherly API",
    version: "1.0.0",
    description:
      "Platform tiket acara komunitas dengan reservasi kuota atomik, integrasi Midtrans Sandbox, penerbitan tiket QR, dan validasi check-in panitia.",
    contact: {
      name: "Kelompok 11 - Gatherly",
    },
  },
  servers: [
    {
      url: "/api/v1",
      description: "Local Development Server",
    },
  ],
  tags: [
    { name: "System", description: "Health check & status layanan" },
    { name: "Auth", description: "Registrasi, login sesi, info akun, dan CSRF" },
    { name: "Organizers", description: "Profil organizer acara" },
    { name: "Organizer Events", description: "Manajemen event, jenis tiket, dan assignment panitia" },
    { name: "Orders", description: "Reservasi tiket atomik dan inisiasi sesi pembayaran" },
    { name: "Payments", description: "Webhook penerimaan notifikasi Midtrans" },
    { name: "Tickets", description: "Katalog tiket pembeli dan credential QR" },
    { name: "Committee", description: "Operasional validasi check-in di lokasi acara" },
    { name: "Organizer Reports", description: "Laporan penjualan, inventori, dan kehadiran acara" },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "gatherly_session",
        description: "HttpOnly session cookie didapat setelah login",
      },
      csrfToken: {
        type: "apiKey",
        in: "header",
        name: "X-CSRF-Token",
        description: "Token CSRF dari GET /auth/me untuk mutasi (POST/PATCH/DELETE)",
      },
      idempotencyKey: {
        type: "apiKey",
        in: "header",
        name: "Idempotency-Key",
        description: "UUID v4 unik per transaksi checkout untuk mencegah double order",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "VALIDATION_ERROR" },
              message: { type: "string", example: "Please check the submitted fields." },
              fields: { type: "object", additionalProperties: { type: "string" } },
              details: { type: "object" },
            },
            required: ["code", "message"],
          },
          requestId: { type: "string", example: "3fa85f64-5717-4562-b3fc-2c963f66afa6" },
        },
        required: ["error", "requestId"],
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
          name: { type: "string", example: "Alya Putri" },
          email: { type: "string", format: "email", example: "alya@example.com" },
        },
      },
      Organizer: {
        type: "object",
        properties: {
          id: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d2" },
          name: { type: "string", example: "Komunitas Kreatif Jogja" },
          description: { type: "string", example: "Wadah kolaborasi pemuda kreatif Yogyakarta" },
          contactEmail: { type: "string", format: "email", example: "halo@kreatifjogja.id" },
        },
      },
      Event: {
        type: "object",
        properties: {
          id: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d3" },
          slug: { type: "string", example: "gathering-desain-2026-ab12cd" },
          title: { type: "string", example: "Gathering Komunitas Desain 2026" },
          description: { type: "string", example: "Diskusi santai dan workshop Figma untuk pemula." },
          category: { type: "string", example: "Technology & Design" },
          startsAt: { type: "string", format: "date-time", example: "2026-10-24T09:00:00.000Z" },
          endsAt: { type: "string", format: "date-time", example: "2026-10-24T17:00:00.000Z" },
          timezone: { type: "string", example: "Asia/Jakarta" },
          venueName: { type: "string", example: "Ruang Kolaborasi Lantai 2" },
          address: { type: "string", example: "Jl. Kaliurang KM 5" },
          city: { type: "string", example: "Sleman" },
          posterAssetId: { type: "string", nullable: true, example: "poster-xyz-123" },
          publicationStatus: { type: "string", enum: ["draft", "published"], example: "published" },
          salesClosed: { type: "boolean", example: false },
        },
      },
      TicketType: {
        type: "object",
        properties: {
          id: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d4" },
          name: { type: "string", example: "Early Bird" },
          description: { type: "string", example: "Akses reguler dengan diskon early bird" },
          price: { type: "integer", example: 75000 },
          capacity: { type: "integer", example: 100 },
          available: { type: "integer", example: 45 },
          salesStartsAt: { type: "string", format: "date-time", example: "2026-09-01T00:00:00.000Z" },
          salesEndsAt: { type: "string", format: "date-time", example: "2026-10-20T23:59:59.000Z" },
        },
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d5" },
          orderCode: { type: "string", example: "GTH-A1B2C3D4E5" },
          event: {
            type: "object",
            properties: {
              title: { type: "string" },
              startsAt: { type: "string", format: "date-time" },
              timezone: { type: "string" },
              venueName: { type: "string" },
              address: { type: "string" },
              city: { type: "string" },
            },
          },
          ticketType: {
            type: "object",
            properties: {
              name: { type: "string" },
              unitPrice: { type: "integer" },
            },
          },
          quantity: { type: "integer", minimum: 1, maximum: 4, example: 2 },
          attendees: {
            type: "array",
            items: {
              type: "object",
              properties: { name: { type: "string", example: "Alya Putri" } },
            },
          },
          totalAmount: { type: "integer", example: 150000 },
          currency: { type: "string", example: "IDR" },
          paymentStatus: { type: "string", enum: ["pending", "paid", "failed", "expired"], example: "pending" },
          reservationStatus: { type: "string", enum: ["held", "converted", "released"], example: "held" },
          issuanceStatus: { type: "string", enum: ["not_ready", "processing", "issued"], example: "not_ready" },
          expiresAt: { type: "string", format: "date-time" },
          serverTime: { type: "string", format: "date-time" },
          isVerifying: { type: "boolean", example: false },
          canResumePayment: { type: "boolean", example: true },
          ticketIds: { type: "array", items: { type: "string" } },
        },
      },
      TicketListItem: {
        type: "object",
        properties: {
          id: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d6" },
          orderId: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d5" },
          event: {
            type: "object",
            properties: {
              title: { type: "string" },
              startsAt: { type: "string", format: "date-time" },
              timezone: { type: "string" },
              venueName: { type: "string" },
              address: { type: "string" },
              city: { type: "string" },
            },
          },
          ticketType: {
            type: "object",
            properties: { name: { type: "string" } },
          },
          attendeeName: { type: "string", example: "Alya Putri" },
          ticketCode: { type: "string", example: "GTH-T-E8F9A0B1C2D3" },
          checkInStatus: { type: "string", enum: ["unused", "used"], example: "unused" },
          checkedInAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      TicketDetail: {
        allOf: [
          { $ref: "#/components/schemas/TicketListItem" },
          {
            type: "object",
            properties: {
              qrPayload: {
                type: "string",
                example: "gatherly:v1:qK8...randomCredential...32Bytes",
                description: "Format string untuk dirender menjadi QR code oleh frontend",
              },
            },
          },
        ],
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Periksa status server",
        responses: {
          200: {
            description: "Server berjalan normal",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        service: { type: "string", example: "gatherly-api" },
                        status: { type: "string", example: "ok" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Registrasi pengguna baru",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", minLength: 2, maxLength: 100, example: "Alya Putri" },
                  email: { type: "string", format: "email", example: "alya@example.com" },
                  password: { type: "string", minLength: 12, maxLength: 128, example: "PasswordSangatAman123!" },
                },
                required: ["name", "email", "password"],
              },
            },
          },
        },
        responses: {
          202: {
            description: "OTP registrasi telah dikirim",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        challengeId: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
                        expiresAt: { type: "string", format: "date-time" },
                        resendAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
          409: {
            description: "Email sudah terdaftar",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login dengan email dan password",
        description: "Memvalidasi password dan mengirim OTP. Sesi baru dibuat setelah OTP diverifikasi.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email", example: "alya@example.com" },
                  password: { type: "string", example: "PasswordSangatAman123!" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          202: {
            description: "Password valid dan OTP login telah dikirim",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        challengeId: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
                        expiresAt: { type: "string", format: "date-time" },
                        resendAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Email atau password salah",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
    "/auth/register/verify": {
      post: {
        tags: ["Auth"],
        summary: "Verifikasi OTP registrasi",
        description: "Membuat akun dan session cookie setelah OTP valid.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["challengeId", "code"],
                properties: {
                  challengeId: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
                  code: { type: "string", pattern: "^[0-9]{6}$", example: "123456" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Registrasi dan login berhasil" },
          409: { description: "OTP salah, kedaluwarsa, terkunci, atau sudah digunakan" },
        },
      },
    },
    "/auth/login/verify": {
      post: {
        tags: ["Auth"],
        summary: "Verifikasi OTP login",
        description: "Membuat session cookie dan mengembalikan CSRF token setelah OTP valid.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["challengeId", "code"],
                properties: {
                  challengeId: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
                  code: { type: "string", pattern: "^[0-9]{6}$", example: "123456" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Login berhasil" },
          409: { description: "OTP salah, kedaluwarsa, terkunci, atau sudah digunakan" },
        },
      },
    },
    "/auth/otp/resend": {
      post: {
        tags: ["Auth"],
        summary: "Kirim ulang OTP",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["challengeId"],
                properties: { challengeId: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" } },
              },
            },
          },
        },
        responses: {
          200: { description: "OTP baru telah dikirim" },
          429: { description: "Masih dalam masa cooldown" },
        },
      },
    },
    "/auth/google": {
      get: {
        tags: ["Auth"],
        summary: "Mulai login dengan Google",
        description: "Mengalihkan browser ke halaman autentikasi Google.",
        responses: {
          302: { description: "Redirect ke Google" },
          503: { description: "Google OAuth belum dikonfigurasi" },
        },
      },
    },
    "/auth/google/callback": {
      get: {
        tags: ["Auth"],
        summary: "Callback Google OAuth",
        description: "Memvalidasi state, membuat session cookie, dan mengalihkan browser ke frontend.",
        responses: { 302: { description: "Redirect ke frontend dengan status autentikasi" } },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Ambil informasi sesi pengguna aktif dan token CSRF terbaru",
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: "Data sesi aktif",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        user: { $ref: "#/components/schemas/User" },
                        organizerId: { type: "string", nullable: true, example: "64f1a2b3c4d5e6f7a8b9c0d2" },
                        hasCommitteeAssignments: { type: "boolean", example: true },
                        csrfToken: { type: "string", example: "csrf-token-string" },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: "Belum login" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout dan bersihkan sesi",
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        responses: {
          204: { description: "Sesi berhasil dihapus" },
          401: { description: "Belum login" },
        },
      },
    },
    "/organizers": {
      post: {
        tags: ["Organizers"],
        summary: "Buat profil organizer untuk akun",
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", minLength: 2, maxLength: 100, example: "Komunitas Kreatif" },
                  description: { type: "string", minLength: 1, maxLength: 2000, example: "Deskripsi organizer" },
                  contactEmail: { type: "string", format: "email", example: "kontak@kreatif.org" },
                },
                required: ["name", "description", "contactEmail"],
              },
            },
          },
        },
        responses: {
          201: {
            description: "Profil organizer berhasil dibuat",
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Organizer" } } } } },
          },
          409: { description: "Akun ini sudah memiliki profil organizer" },
        },
      },
    },
    "/organizers/me": {
      get: {
        tags: ["Organizers"],
        summary: "Lihat profil organizer milik sendiri",
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: "Data profil organizer",
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Organizer" } } } } },
          },
          404: { description: "Belum membuat profil organizer" },
        },
      },
    },
    "/organizer/events": {
      get: {
        tags: ["Organizer Events"],
        summary: "Daftar acara milik organizer",
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: "Daftar acara",
            content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Event" } } } } } },
          },
        },
      },
      post: {
        tags: ["Organizer Events"],
        summary: "Buat draf acara baru",
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string", example: "Gathering Komunitas Desain" },
                  description: { type: "string", example: "Workshop & networking" },
                  category: { type: "string", example: "Technology" },
                  startsAt: { type: "string", format: "date-time", example: "2026-11-01T09:00:00Z" },
                  endsAt: { type: "string", format: "date-time", example: "2026-11-01T17:00:00Z" },
                  timezone: { type: "string", example: "Asia/Jakarta" },
                  venueName: { type: "string", example: "Gedung Serbaguna" },
                  address: { type: "string", example: "Jl. Affandi No. 10" },
                  city: { type: "string", example: "Yogyakarta" },
                  posterAssetId: { type: "string", example: "poster_id_1" },
                },
                required: ["title", "description", "category", "startsAt", "endsAt", "timezone", "venueName", "address", "city"],
              },
            },
          },
        },
        responses: {
          201: {
            description: "Draf acara berhasil dibuat",
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Event" } } } } },
          },
        },
      },
    },
    "/organizer/events/{id}": {
      get: {
        tags: ["Organizer Events"],
        summary: "Detail draf/acara organizer",
        security: [{ cookieAuth: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          200: { content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Event" } } } } } },
          404: { description: "Acara tidak ditemukan" },
        },
      },
      patch: {
        tags: ["Organizer Events"],
        summary: "Ubah data acara",
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  salesClosed: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: { content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Event" } } } } } },
        },
      },
      delete: {
        tags: ["Organizer Events"],
        summary: "Hapus draf acara (hanya jika belum memiliki tiket/order)",
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          204: { description: "Draf acara berhasil dihapus" },
          409: { description: "Acara published atau sudah memiliki pesanan tidak dapat dihapus" },
        },
      },
    },
    "/organizer/events/{id}/publish": {
      post: {
        tags: ["Organizer Events"],
        summary: "Publikasikan acara (wajib poster dan minimal 1 tipe tiket)",
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Acara berhasil dipublikasikan" },
          409: { description: "Syarat poster atau jenis tiket belum terpenuhi" },
        },
      },
    },
    "/organizer/events/{id}/ticket-types": {
      post: {
        tags: ["Organizer Events"],
        summary: "Tambah tipe tiket baru ke acara",
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", example: "Presale" },
                  description: { type: "string", example: "Kuota terbatas" },
                  price: { type: "integer", example: 50000 },
                  capacity: { type: "integer", example: 50 },
                  salesStartsAt: { type: "string", format: "date-time" },
                  salesEndsAt: { type: "string", format: "date-time" },
                },
                required: ["name", "description", "price", "capacity", "salesStartsAt", "salesEndsAt"],
              },
            },
          },
        },
        responses: {
          201: { content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/TicketType" } } } } } },
        },
      },
    },
    "/organizer/events/{id}/committee": {
      get: {
        tags: ["Organizer Events"],
        summary: "Lihat daftar panitia yang ditugaskan",
        security: [{ cookieAuth: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          200: {
            description: "Daftar panitia",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          userId: { type: "string" },
                          name: { type: "string" },
                          email: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Organizer Events"],
        summary: "Tugaskan panitia baru berdasarkan email",
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { email: { type: "string", format: "email", example: "panitia@example.com" } },
                required: ["email"],
              },
            },
          },
        },
        responses: {
          201: { description: "Panitia berhasil ditugaskan" },
          404: { description: "Akun dengan email ini belum terdaftar" },
          409: { description: "Akun sudah menjadi panitia di acara ini" },
        },
      },
    },
    "/orders": {
      post: {
        tags: ["Orders"],
        summary: "Buat pesanan & reservasi kuota tiket (Atomik)",
        description: "Wajib menyertakan header `Idempotency-Key` (UUID v4) untuk mencegah pesanan ganda.",
        security: [{ cookieAuth: [] }, { csrfToken: [] }, { idempotencyKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ticketTypeId: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d4" },
                  quantity: { type: "integer", minimum: 1, maximum: 4, example: 2 },
                  attendees: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { name: { type: "string", minLength: 2, maxLength: 100, example: "Alya Putri" } },
                      required: ["name"],
                    },
                  },
                },
                required: ["ticketTypeId", "quantity", "attendees"],
              },
            },
          },
        },
        responses: {
          201: {
            description: "Reservasi berhasil dibuat",
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Order" } } } } },
          },
          200: {
            description: "Request idempoten (mengembalikan pesanan yang sudah ada)",
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Order" } } } } },
          },
          409: { description: "Tiket habis (SOLD_OUT) atau Idempotency-Key konflik" },
        },
      },
      get: {
        tags: ["Orders"],
        summary: "Daftar pesanan milik pembeli yang sedang login",
        security: [{ cookieAuth: [] }],
        parameters: [
          { in: "query", name: "page", schema: { type: "integer", default: 1 } },
          { in: "query", name: "limit", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: {
            description: "Daftar riwayat pesanan",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Order" } },
                    meta: {
                      type: "object",
                      properties: { page: { type: "integer" }, limit: { type: "integer" }, total: { type: "integer" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/orders/{id}/payment-session": {
      post: {
        tags: ["Orders"],
        summary: "Inisiasi sesi pembayaran Midtrans Snap",
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          200: {
            description: "Token Snap dan URL redirect siap",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        snapToken: { type: "string", example: "snap-token-abc" },
                        redirectUrl: { type: "string", example: "https://app.sandbox.midtrans.com/snap/v2/vtweb/..." },
                        expiresAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
          202: { description: "Sesi sedang dibuat di provider (silakan retry polling)" },
          409: { description: "Pesanan sudah expired atau tidak dapat dibayar lagi" },
        },
      },
    },
    "/orders/{id}": {
      get: {
        tags: ["Orders"],
        summary: "Detail pesanan pembeli",
        security: [{ cookieAuth: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          200: { content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Order" } } } } } },
          404: { description: "Pesanan tidak ditemukan" },
        },
      },
    },
    "/payments/midtrans/notifications": {
      post: {
        tags: ["Payments"],
        summary: "Webhook notifikasi Midtrans Sandbox",
        description: "Menerima callback status pembayaran dari Midtrans (diverifikasi via SHA-512 signature).",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: { received: { type: "boolean", example: true }, duplicate: { type: "boolean", example: false } },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Signature key atau nominal tidak valid" },
        },
      },
    },
    "/tickets": {
      get: {
        tags: ["Tickets"],
        summary: "Daftar tiket elektronik milik pembeli",
        description: "Menampilkan tiket pembeli tanpa membocorkan credential QR.",
        security: [{ cookieAuth: [] }],
        parameters: [
          { in: "query", name: "page", schema: { type: "integer", default: 1 } },
          { in: "query", name: "limit", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/TicketListItem" } },
                    meta: { type: "object", properties: { page: { type: "integer" }, limit: { type: "integer" }, total: { type: "integer" } } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/tickets/{ticketId}": {
      get: {
        tags: ["Tickets"],
        summary: "Detail tiket pembeli beserta data QR Code",
        security: [{ cookieAuth: [] }],
        parameters: [{ in: "path", name: "ticketId", required: true, schema: { type: "string" } }],
        responses: {
          200: {
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/TicketDetail" } } } } },
          },
          404: { description: "Tiket tidak ditemukan" },
        },
      },
    },
    "/committee/events/{eventId}/tickets": {
      get: {
        tags: ["Committee"],
        summary: "Pencarian tiket peserta oleh panitia",
        security: [{ cookieAuth: [] }],
        parameters: [
          { in: "path", name: "eventId", required: true, schema: { type: "string" } },
          { in: "query", name: "q", schema: { type: "string" }, description: "Cari nama peserta atau kode tiket" },
        ],
        responses: {
          200: { description: "Hasil pencarian tiket" },
          403: { description: "Bukan panitia yang ditugaskan untuk acara ini" },
        },
      },
    },
    "/committee/events/{eventId}/check-ins": {
      get: {
        tags: ["Committee"],
        summary: "Riwayat check-in acara",
        security: [{ cookieAuth: [] }],
        parameters: [{ in: "path", name: "eventId", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Log riwayat check-in" } },
      },
      post: {
        tags: ["Committee"],
        summary: "Validasi check-in tiket (Scan QR atau Kode Tiket)",
        description: "Validasi status tiket atomik: hanya tiket `unused` yang berubah menjadi `used`.",
        security: [{ cookieAuth: [] }, { csrfToken: [] }],
        parameters: [{ in: "path", name: "eventId", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  qrPayload: { type: "string", example: "gatherly:v1:qK8...credential" },
                  ticketCode: { type: "string", example: "GTH-T-E8F9A0B1C2D3" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Check-in berhasil",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        ticketId: { type: "string" },
                        attendeeName: { type: "string" },
                        ticketTypeName: { type: "string" },
                        checkInStatus: { type: "string", example: "used" },
                        checkedInAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
          409: { description: "Tiket sudah pernah digunakan sebelumnya (USED)" },
        },
      },
    },
    "/organizer/summary": {
      get: {
        tags: ["Organizer Reports"],
        summary: "Ringkasan total penjualan dan event organizer",
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        publishedEvents: { type: "integer", example: 3 },
                        paidTickets: { type: "integer", example: 120 },
                        grossPaidSales: { type: "integer", example: 9000000 },
                        period: { type: "object" },
                        generatedAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/organizer/events/{eventId}/summary": {
      get: {
        tags: ["Organizer Reports"],
        summary: "Ringkasan metrik dan penjualan per event",
        security: [{ cookieAuth: [] }],
        parameters: [{ in: "path", name: "eventId", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Ringkasan metrik acara" } },
      },
    },
    "/organizer/events/{eventId}/orders": {
      get: {
        tags: ["Organizer Reports"],
        summary: "Daftar pesanan acara",
        security: [{ cookieAuth: [] }],
        parameters: [
          { in: "path", name: "eventId", required: true, schema: { type: "string" } },
          { in: "query", name: "q", schema: { type: "string" } },
          { in: "query", name: "paymentStatus", schema: { type: "string", enum: ["pending", "paid", "failed", "expired"] } },
        ],
        responses: { 200: { description: "Daftar pesanan acara" } },
      },
    },
    "/organizer/events/{eventId}/attendees": {
      get: {
        tags: ["Organizer Reports"],
        summary: "Daftar kehadiran dan tiket peserta acara",
        security: [{ cookieAuth: [] }],
        parameters: [
          { in: "path", name: "eventId", required: true, schema: { type: "string" } },
          { in: "query", name: "checkInStatus", schema: { type: "string", enum: ["unused", "used"] } },
        ],
        responses: { 200: { description: "Daftar peserta" } },
      },
    },
  },
};
