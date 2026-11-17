"""Browser regression tests. Run against the local frontend with Python Playwright installed.

GATHERLY_TEST_URL defaults to http://admin.localhost:3218.
"""
import os
import unittest
from playwright.sync_api import sync_playwright


class AdminJourneys(unittest.TestCase):
    def setUp(self):
        self.runtime = sync_playwright().start()
        self.browser = self.runtime.chromium.launch(headless=True)
        self.width = int(os.environ.get("GATHERLY_TEST_WIDTH", "1440"))
        self.context = self.browser.new_context(viewport={"width": self.width, "height": 1000})
        self.page = self.context.new_page()
        self.page.set_default_timeout(8000)
        self.page_errors = []
        self.page.on("pageerror", lambda error: self.page_errors.append(str(error)))
        self.base = os.environ.get("GATHERLY_TEST_URL", "http://admin.localhost:3218")

    def tearDown(self):
        self.browser.close()
        self.runtime.stop()
        self.assertEqual(self.page_errors, [], "Browser runtime errors")

    def login(self):
        page = self.page
        page.goto(self.base + "/login", wait_until="networkidle")
        folder = os.path.join("apps", "frontend", "test-results", str(self.width))
        os.makedirs(folder, exist_ok=True)
        page.screenshot(path=os.path.join(folder, "login.png"), full_page=True)
        page.get_by_label("Email kerja").fill("nadia@gatherlyy.fun")
        page.get_by_label("Password", exact=True).fill("GatherlyDemo123!")
        page.get_by_role("button", name="Masuk", exact=True).click()
        page.wait_for_url("**/verify")
        page.get_by_role("heading", name="Verifikasi dua langkah", exact=True).wait_for()
        page.screenshot(path=os.path.join(folder, "verify.png"), full_page=True)
        page.get_by_label("Digit 1").fill("123456")
        page.get_by_role("button", name="Verifikasi", exact=True).click()
        page.wait_for_url("**/applications")

    def test_organizer_never_logged_in_fixture_is_available(self):
        self.login()
        self.page.goto(self.base + "/organizers", wait_until="networkidle")
        self.page.get_by_role("tab", name="Belum pernah masuk", exact=False).click()
        self.page.get_by_role("link", name="Lihat UKM Musik UGM", exact=True).wait_for(timeout=5000)

    def test_application_review_cannot_repeat_completed_action(self):
        self.login()
        self.page.get_by_role("link", name="Tinjau pengajuan", exact=False).first.click()
        self.page.wait_for_url("**/applications/*")
        target = self.page.url
        self.page.get_by_role("button", name="Setujui pengajuan", exact=True).click()
        self.page.get_by_role("dialog").get_by_role("button", name="Setujui pengajuan", exact=True).click()
        self.page.get_by_text("Pengajuan disetujui", exact=True).wait_for()
        self.page.goto(target, wait_until="networkidle")
        self.page.get_by_role("heading", name="Pengajuan disetujui", exact=True).wait_for()
        buttons = self.page.get_by_role("button", name="Setujui pengajuan", exact=True)
        self.assertTrue(buttons.count() == 0 or buttons.is_disabled())

    def test_offline_login_blocks_submission(self):
        self.page.goto(self.base + "/login", wait_until="networkidle")
        self.page.context.set_offline(True)
        self.page.get_by_text("Anda sedang luring", exact=True).wait_for()
        self.assertTrue(self.page.get_by_role("button", name="Masuk", exact=True).is_disabled())

    def test_frozen_organizer_survives_reload(self):
        self.login()
        self.page.goto(self.base + "/organizers/org_kolektifsawah", wait_until="networkidle")
        self.page.get_by_role("button", name="Bekukan organizer", exact=True).click()
        self.page.get_by_label("Alasan pembekuan").fill("Pengaduan peserta sedang ditinjau")
        dialog = self.page.get_by_role("dialog")
        dialog.get_by_role("textbox").last.fill("Kolektif Sawah")
        dialog.get_by_role("button", name="Bekukan organizer", exact=True).click()
        self.page.get_by_role("status").filter(has_text="Organizer dibekukan").wait_for()
        self.page.reload(wait_until="networkidle")
        self.page.get_by_role("button", name="Aktifkan kembali", exact=True).wait_for()

    def test_application_documents_are_viewable(self):
        self.login()
        self.page.goto(self.base + "/applications/app_0042", wait_until="networkidle")
        self.page.get_by_role("button", name="Lihat dokumen", exact=False).first.click(timeout=3000)
        self.page.get_by_role("dialog").wait_for()
        self.page.get_by_role("button", name="Tutup", exact=True).click()
        self.assertEqual(self.page.get_by_role("dialog").count(), 0)

    def test_unknown_application_is_not_a_copy_of_existing_application(self):
        self.login()
        self.page.goto(self.base + "/applications/does-not-exist", wait_until="networkidle")
        self.page.get_by_role("heading", name="Pengajuan tidak ditemukan").wait_for(timeout=3000)

    def test_closed_report_cannot_be_closed_again(self):
        self.login()
        self.page.goto(self.base + "/reports", wait_until="networkidle")
        self.page.get_by_role("link", name="Tinjau laporan", exact=False).first.click()
        self.page.wait_for_url("**/reports/*")
        target = self.page.url
        self.page.get_by_role("button", name="Tutup laporan", exact=True).click()
        self.page.get_by_label("Catatan penanganan").fill("Sudah ditinjau bersama organizer")
        self.page.get_by_role("dialog").get_by_role("button", name="Tutup laporan", exact=True).click()
        self.page.get_by_role("heading", name="Laporan ditutup", exact=True).wait_for()
        self.page.goto(target, wait_until="networkidle")
        self.page.get_by_role("heading", name="Laporan ditutup", exact=True).wait_for(timeout=3000)

    def test_request_fix_requires_notes_and_moves_queue(self):
        self.login()
        self.page.goto(self.base + "/applications/app_0042", wait_until="networkidle")
        self.page.get_by_role("checkbox", name="Perlu perbaikan Deskripsi", exact=True).check()
        self.assertTrue(self.page.get_by_role("button", name="Setujui pengajuan", exact=True).is_disabled())
        self.assertTrue(self.page.get_by_role("button", name="Minta perbaikan", exact=True).is_disabled())
        self.page.get_by_label("Catatan perbaikan Deskripsi", exact=True).fill("Jelaskan acara yang diselenggarakan")
        self.page.get_by_role("button", name="Minta perbaikan", exact=True).click()
        self.page.get_by_role("dialog").get_by_role("button", name="Kirim permintaan", exact=True).click()
        self.page.get_by_role("heading", name="Menunggu perbaikan", exact=True).wait_for()
        self.page.goto(self.base + "/applications", wait_until="networkidle")
        self.page.get_by_role("tab", name="Menunggu perbaikan", exact=False).click()
        self.page.get_by_role("link", name="Tinjau pengajuan Kolektif Sawah", exact=True).wait_for()

    def test_review_rejects_overlong_notes_and_reasons(self):
        self.login()
        self.page.goto(self.base + "/applications/app_0042", wait_until="networkidle")
        self.page.get_by_role("checkbox", name="Perlu perbaikan Deskripsi", exact=True).check()
        self.page.get_by_label("Catatan perbaikan Deskripsi", exact=True).fill("a" * 2001)
        self.assertTrue(self.page.get_by_role("button", name="Minta perbaikan", exact=True).is_disabled())
        self.page.get_by_role("button", name="Tolak pengajuan", exact=True).click()
        self.page.get_by_label("Alasan penolakan", exact=True).fill("a" * 2001)
        self.assertTrue(self.page.get_by_role("dialog").get_by_role("button", name="Tolak pengajuan", exact=True).is_disabled())

    def test_corrected_fields_and_pdf_viewer(self):
        self.login()
        self.page.goto(self.base + "/applications/app_0041", wait_until="networkidle")
        self.page.get_by_text("Diperbarui", exact=True).first.wait_for()
        self.page.get_by_role("button", name="Lihat dokumen contoh-legalitas.pdf", exact=True).click()
        self.page.locator("iframe").wait_for()
        self.page.keyboard.press("Escape")
        self.assertEqual(self.page.get_by_role("dialog").count(), 0)

    def test_reject_requires_reason_and_persists(self):
        self.login()
        self.page.goto(self.base + "/applications/app_0040", wait_until="networkidle")
        self.page.get_by_role("button", name="Tolak pengajuan", exact=True).click()
        dialog = self.page.get_by_role("dialog")
        self.assertTrue(dialog.get_by_role("button", name="Tolak pengajuan", exact=True).is_disabled())
        self.page.get_by_label("Alasan penolakan", exact=True).fill("Dokumen tidak sesuai ketentuan")
        dialog.get_by_role("button", name="Tolak pengajuan", exact=True).click()
        self.page.get_by_role("heading", name="Pengajuan ditolak", exact=True).wait_for()
        self.page.reload(wait_until="networkidle")
        self.page.get_by_text("Dokumen tidak sesuai ketentuan", exact=True).wait_for()

    def test_payout_requires_reference_and_past_date(self):
        self.login()
        self.page.goto(self.base + "/payouts", wait_until="networkidle")
        self.page.get_by_role("button", name="Proses pencairan", exact=True).first.click()
        dialog = self.page.get_by_role("dialog")
        self.assertTrue(dialog.get_by_role("button", name="Tandai selesai", exact=True).is_disabled())
        self.page.get_by_label("Nomor referensi transfer", exact=True).fill("REF-DEMO-01")
        self.page.get_by_label("Tanggal transfer", exact=True).fill("2099-01-01T12:00")
        self.assertTrue(dialog.get_by_role("button", name="Tandai selesai", exact=True).is_disabled())
        self.page.get_by_label("Tanggal transfer", exact=True).fill("2026-01-01T12:00")
        dialog.get_by_role("button", name="Tandai selesai", exact=True).click()
        self.page.get_by_text("Pencairan selesai dicatat", exact=True).wait_for()
        self.page.reload(wait_until="networkidle")
        self.page.get_by_role("tab", name="Selesai", exact=False).click()
        self.page.locator("span:visible").filter(has_text="REF-DEMO-01").first.wait_for()

    def test_all_pages_fit_viewport(self):
        self.login()
        for route in ["/applications", "/applications/app_0042", "/organizers", "/organizers/org_kolektifsawah", "/payouts", "/reports", "/reports/rp_1"]:
            with self.subTest(route=route):
                self.page.goto(self.base + route, wait_until="networkidle")
                self.assertFalse(self.page.evaluate("document.documentElement.scrollWidth > innerWidth"), route)
                folder = os.path.join("apps", "frontend", "test-results", str(self.width))
                os.makedirs(folder, exist_ok=True)
                self.page.screenshot(path=os.path.join(folder, route.strip("/").replace("/", "-") + ".png"), full_page=True)

    def test_queues_empty_error_and_offline(self):
        self.login()
        for scope, title in [("applications", "Pengajuan"), ("organizers", "Organizer"), ("payouts", "Pencairan"), ("reports", "Laporan")]:
            for scenario in ["error", "empty"]:
                with self.subTest(scope=scope, scenario=scenario):
                    self.page.evaluate("([scope, value]) => sessionStorage.setItem('gatherly_admin_scenario_' + scope, value)", [scope, scenario])
                    self.page.goto(self.base + "/" + scope, wait_until="networkidle")
                    if scenario == "error":
                        self.page.get_by_role("heading", name=title + " gagal dimuat", exact=True).wait_for(timeout=15000)
                    else:
                        self.page.get_by_role("heading", name="Belum ada pengajuan" if scope == "applications" else "Tidak ada organizer" if scope == "organizers" else "Antrean pencairan kosong" if scope == "payouts" else "Belum ada laporan", exact=True).wait_for()
            self.page.evaluate("scope => sessionStorage.removeItem('gatherly_admin_scenario_' + scope)", scope)
        self.page.context.set_offline(True)
        self.page.get_by_role("heading", name="Anda sedang luring", exact=True).wait_for()

    def test_search_keeps_focus_and_supports_no_results(self):
        self.login()
        field = self.page.get_by_role("searchbox", name="Cari pengajuan", exact=True)
        field.press_sequentially("Sawah", delay=150)
        self.assertEqual(field.input_value(), "Sawah")
        self.page.get_by_role("link", name="Tinjau pengajuan Kolektif Sawah", exact=True).wait_for()
        field.fill("Tidak ada organizer ini")
        self.page.get_by_role("heading", name="Tidak ada hasil", exact=True).wait_for()

    def test_organizer_detail_includes_drafts_and_public_profile(self):
        self.login()
        self.page.goto(self.base + "/organizers/org_kolektifsawah", wait_until="networkidle")
        self.page.get_by_text("Pameran Zine Jogja", exact=True).wait_for()
        link = self.page.get_by_role("link", name="Lihat profil publik", exact=True)
        self.assertTrue(link.get_attribute("href").endswith("/organizers/kolektifsawah"))

    def test_report_links_to_the_corresponding_event(self):
        self.login()
        self.page.goto(self.base + "/reports/rp_2", wait_until="networkidle")
        link = self.page.get_by_role("link", name="Lihat halaman acara", exact=True)
        self.assertTrue(link.get_attribute("href").endswith("/events/pameran-foto-kampung-kota"))

    def test_username_and_review_conflicts(self):
        self.login()
        self.page.evaluate("sessionStorage.setItem('gatherly_admin_scenario_applications', 'username_conflict')")
        self.page.goto(self.base + "/applications/app_0042", wait_until="networkidle")
        self.page.get_by_text("Username sudah dipakai", exact=True).first.wait_for()
        self.assertTrue(self.page.get_by_role("button", name="Setujui pengajuan", exact=True).is_disabled())
        self.page.evaluate("sessionStorage.setItem('gatherly_admin_scenario_applications', 'review_conflict')")
        self.page.reload(wait_until="networkidle")
        self.page.get_by_role("button", name="Setujui pengajuan", exact=True).click()
        self.page.get_by_role("dialog").get_by_role("button", name="Setujui pengajuan", exact=True).click()
        self.page.get_by_text("Pengajuan sudah ditinjau admin lain.", exact=False).wait_for()

    def test_unfreeze_resend_and_exact_confirmation(self):
        self.login()
        self.page.goto(self.base + "/organizers/org_frozen", wait_until="networkidle")
        self.page.get_by_role("button", name="Aktifkan kembali", exact=True).click()
        self.page.get_by_role("dialog").get_by_role("button", name="Aktifkan kembali", exact=True).click()
        self.page.get_by_text("Organizer diaktifkan kembali", exact=True).wait_for()
        self.page.goto(self.base + "/organizers/org_ukm", wait_until="networkidle")
        self.page.get_by_role("button", name="Kirim ulang akses", exact=True).click()
        self.page.get_by_role("dialog").get_by_role("button", name="Kirim ulang akses", exact=True).click()
        self.page.get_by_text("Akses dikirim ulang", exact=True).wait_for()
        self.page.get_by_role("button", name="Bekukan organizer", exact=True).click()
        self.page.get_by_label("Alasan pembekuan", exact=True).fill("Perlu ditinjau")
        self.page.get_by_role("dialog").get_by_role("textbox").last.fill("UKM Musik UGM ")
        self.assertTrue(self.page.get_by_role("dialog").get_by_role("button", name="Bekukan organizer", exact=True).is_disabled())

    def test_auth_validation_errors_backup_and_expired_challenge(self):
        page = self.page
        page.goto(self.base + "/login", wait_until="networkidle")
        page.get_by_label("Email kerja").fill("nadia@gmail.com")
        page.get_by_label("Password", exact=True).focus()
        page.get_by_text("Gunakan email kerja Gatherly.", exact=True).wait_for()
        page.get_by_role("button", name="Lupa password?", exact=True).click()
        page.get_by_role("heading", name="Hubungi admin utama", exact=True).wait_for()
        page.get_by_role("button", name="Kembali ke masuk", exact=True).click()
        for email, error in [("locked@gatherlyy.fun", "Akun dikunci sementara."), ("disabled@gatherlyy.fun", "Akun dinonaktifkan."), ("bad@gatherlyy.fun", "Tidak dapat masuk.")]:
            page.get_by_label("Email kerja").fill(email)
            page.get_by_label("Password", exact=True).fill("wrong")
            page.get_by_role("button", name="Masuk", exact=True).click()
            page.get_by_text(error, exact=False).wait_for()
        page.get_by_label("Email kerja").fill("nadia@gatherlyy.fun")
        page.get_by_label("Password", exact=True).fill("GatherlyDemo123!")
        page.get_by_role("button", name="Masuk", exact=True).click()
        page.wait_for_url("**/verify")
        page.get_by_label("Digit 1").fill("000000")
        page.get_by_role("button", name="Verifikasi", exact=True).click()
        page.get_by_text("Kode tidak sesuai.", exact=False).wait_for()
        page.get_by_role("link", name="Gunakan kode cadangan", exact=True).click()
        page.get_by_label("Kode cadangan", exact=True).fill("DEMO-BACKUP-01")
        page.get_by_role("button", name="Verifikasi", exact=True).click()
        page.wait_for_url("**/applications")
        page.goto(self.base + "/verify", wait_until="networkidle")
        page.get_by_label("Digit 1").fill("123456")
        page.get_by_role("button", name="Verifikasi", exact=True).click()
        page.get_by_role("heading", name="Sesi verifikasi berakhir", exact=True).wait_for()

    def test_idle_session_returns_to_login_with_explanation(self):
        self.login()
        self.page.evaluate("sessionStorage.setItem('gatherly_admin_demo_session', JSON.stringify({expiresAt:Date.now()+100000,lastActiveAt:1}))")
        self.page.reload(wait_until="networkidle")
        self.page.wait_for_url("**/login?**")
        self.page.get_by_text("Sesi Anda telah berakhir.", exact=False).wait_for()

    def test_report_freeze_continues_to_confirmation(self):
        self.login()
        self.page.goto(self.base + "/reports/rp_1", wait_until="networkidle")
        self.page.get_by_role("link", name="Bekukan organizer", exact=True).click()
        self.page.get_by_role("dialog").get_by_role("heading", name="Bekukan organizer?", exact=True).wait_for()

    def test_document_keyboard_zoom_rotate_download_and_close(self):
        self.login()
        self.page.goto(self.base + "/applications/app_0042", wait_until="networkidle")
        self.page.get_by_role("button", name="Lihat dokumen", exact=False).first.click()
        dialog = self.page.get_by_role("dialog")
        image = dialog.get_by_role("img")
        image.wait_for()
        self.assertTrue(image.evaluate("el => el.complete && el.naturalWidth > 0"))
        self.page.keyboard.press("+")
        self.assertIn("1.25", image.get_attribute("style"))
        self.page.keyboard.press("r")
        self.assertIn("90deg", image.get_attribute("style"))
        with self.page.expect_download():
            dialog.get_by_role("link", name="Unduh", exact=True).click()
        self.page.keyboard.press("Escape")
        self.assertEqual(self.page.get_by_role("dialog").count(), 0)

    def test_document_failure_is_visible(self):
        self.login()
        self.page.route("**/mock/admin-document.svg", lambda route: route.abort())
        self.page.goto(self.base + "/applications/app_0042", wait_until="networkidle")
        self.page.get_by_role("button", name="Lihat dokumen", exact=False).first.click()
        self.page.get_by_text("Dokumen gagal dimuat.", exact=False).wait_for()

    def test_failed_mutation_preserves_input_and_allows_retry(self):
        self.login()
        self.page.goto(self.base + "/payouts", wait_until="networkidle")
        self.page.get_by_role("button", name="Proses pencairan", exact=True).first.click()
        self.page.get_by_label("Nomor referensi transfer", exact=True).fill("RETRY-REF")
        self.page.get_by_label("Tanggal transfer", exact=True).fill("2026-01-01T12:00")
        self.page.evaluate("sessionStorage.setItem('gatherly_admin_scenario_payouts', 'error')")
        self.page.get_by_role("dialog").get_by_role("button", name="Tandai selesai", exact=True).click()
        self.page.get_by_text("Pencairan gagal dicatat.", exact=False).wait_for()
        self.assertEqual(self.page.get_by_label("Nomor referensi transfer", exact=True).input_value(), "RETRY-REF")
        self.page.evaluate("sessionStorage.removeItem('gatherly_admin_scenario_payouts')")
        self.page.get_by_role("dialog").get_by_role("button", name="Tandai selesai", exact=True).click()
        self.page.get_by_text("Pencairan selesai dicatat", exact=True).wait_for()

    def test_expired_session_redirects_with_message(self):
        self.login()
        self.page.evaluate("const key = 'gatherly_admin_demo_session'; const session = JSON.parse(sessionStorage.getItem(key)); session.expiresAt = 1; sessionStorage.setItem(key, JSON.stringify(session));")
        self.page.reload(wait_until="networkidle")
        self.page.wait_for_url("**/login?**")
        self.page.get_by_text("Sesi Anda telah berakhir.", exact=False).wait_for()

    def test_remember_device_and_logout(self):
        page = self.page
        page.goto(self.base + "/login", wait_until="networkidle")
        page.get_by_label("Email kerja").fill("nadia@gatherlyy.fun")
        page.get_by_label("Password", exact=True).fill("GatherlyDemo123!")
        page.get_by_role("button", name="Masuk", exact=True).click()
        page.wait_for_url("**/verify")
        page.get_by_role("checkbox", name="Ingat perangkat ini selama 7 hari", exact=True).check()
        page.get_by_label("Digit 1").fill("123456")
        page.get_by_role("button", name="Verifikasi", exact=True).click()
        page.wait_for_url("**/applications")
        remaining = page.evaluate("Number(localStorage.getItem('gatherly_admin_demo_remember')) - Date.now()")
        self.assertTrue(6.9 * 86400000 < remaining <= 7 * 86400000)
        new_page = page.context.new_page()
        new_page.goto(self.base + "/applications", wait_until="networkidle")
        new_page.get_by_role("heading", name="Pengajuan organizer", exact=True).wait_for()
        if self.width < 768:
            new_page.get_by_role("button", name="Buka menu", exact=True).click()
        new_page.get_by_role("button", name="Keluar", exact=True).click()
        new_page.wait_for_url("**/login*")
        self.assertIsNone(new_page.evaluate("localStorage.getItem('gatherly_admin_demo_remember')"))
        new_page.close()

    def test_filter_and_csv_export(self):
        self.login()
        self.page.get_by_role("combobox", name="Jenis organizer", exact=True).click()
        self.page.get_by_role("option", name="Perusahaan", exact=True).click()
        self.page.get_by_role("link", name="Tinjau pengajuan PT Cahaya Panggung", exact=True).wait_for()
        with self.page.expect_download() as download:
            self.page.get_by_role("button", name="Unduh CSV", exact=True).click()
        with open(download.value.path(), encoding="utf-8-sig") as file:
            csv = file.read()
        self.assertIn("PT Cahaya Panggung", csv)
        self.assertNotIn("Kolektif Sawah", csv)

    def test_loading_skeleton(self):
        self.login()
        self.page.add_init_script("const originalTimeout = window.setTimeout; window.setTimeout = (fn, delay, ...args) => originalTimeout(fn, delay === 350 ? 2200 : delay, ...args)")
        self.page.goto(self.base + "/organizers", wait_until="domcontentloaded")
        self.page.get_by_role("status").filter(has_text="Memuat organizer").wait_for()
        folder = os.path.join("apps", "frontend", "test-results", str(self.width))
        self.page.screenshot(path=os.path.join(folder, "loading-organizers.png"), full_page=True)
        self.page.get_by_role("heading", name="Daftar organizer", exact=True).wait_for()


class SharedUpload(unittest.TestCase):
    def setUp(self):
        self.runtime = sync_playwright().start()
        self.browser = self.runtime.chromium.launch(headless=True)
        width = int(os.environ.get("GATHERLY_TEST_WIDTH", "1440"))
        self.page = self.browser.new_page(viewport={"width": width, "height": 1000})
        self.page.set_default_timeout(10000)
        base = os.environ.get("GATHERLY_TEST_URL", "http://admin.localhost:3218").replace("admin.localhost", "localhost")
        self.page.goto(base + "/become-organizer", wait_until="networkidle")

    def tearDown(self):
        self.browser.close()
        self.runtime.stop()

    def test_invalid_format_size_success_cancel_and_drop(self):
        page = self.page
        field = page.locator("#legalDocument")
        field.set_input_files({"name": "wrong.exe", "mimeType": "application/octet-stream", "buffer": b"invalid"})
        page.get_by_text("Format EXE belum didukung.", exact=False).wait_for()
        page.get_by_role("button", name="Hapus berkas", exact=True).click()
        field.set_input_files({"name": "huge.pdf", "mimeType": "application/pdf", "buffer": b"x" * (2 * 1024 * 1024 + 1)})
        page.get_by_text("Ukuran berkas", exact=False).wait_for()
        page.get_by_role("button", name="Hapus berkas", exact=True).click()
        field.set_input_files({"name": "small.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-1.4 test"})
        page.get_by_role("button", name="Batalkan unggahan", exact=True).click()
        page.wait_for_timeout(800)
        self.assertEqual(page.get_by_text("small.pdf", exact=True).count(), 0)
        field.set_input_files({"name": "valid.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-1.4 test"})
        page.get_by_text("terunggah", exact=False).wait_for()
        page.get_by_role("button", name="Hapus berkas", exact=True).click()
        page.locator("label[for=legalDocument]").evaluate("el => { const dt = new DataTransfer(); dt.items.add(new File(['%PDF-1.4 test'], 'drop.pdf', {type: 'application/pdf'})); el.dispatchEvent(new DragEvent('drop', {bubbles: true, dataTransfer: dt})); }")
        page.get_by_text("drop.pdf", exact=True).wait_for()
        page.get_by_text("terunggah", exact=False).wait_for()

    def test_compress_image_under_limit(self):
        import zlib, struct, random
        width = height = 900
        rng = random.Random(42)
        raw = b"".join(b"\x00" + rng.randbytes(width * 3) for _ in range(height))
        def chunk(kind, data):
            return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
        png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
        self.assertGreater(len(png), 1024 * 1024)
        self.page.locator("#ktp").set_input_files({"name": "photo.png", "mimeType": "image/png", "buffer": png})
        self.page.get_by_text("terunggah", exact=False).wait_for(timeout=30000)
        self.assertEqual(self.page.get_by_text("Ukuran berkas", exact=False).count(), 0)

    def test_offline_upload_is_not_reported_successful(self):
        self.page.context.set_offline(True)
        self.page.locator("#legalDocument").set_input_files({"name": "offline.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-1.4 test"})
        self.page.get_by_text("Berkas gagal diunggah.", exact=False).wait_for()
        self.assertEqual(self.page.get_by_text("terunggah", exact=False).count(), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
