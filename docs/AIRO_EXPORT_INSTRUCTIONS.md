# How to obtain the original GoDaddy Airo source

1. Go to the GoDaddy **Airo AI Builder** apps page.
2. Select your site for joshuaupshawphd.com.
3. Open **Settings**. If prompted by the interface, use **New Tab**, then **Settings**.
4. Under **Download Project**, click **Download**.
5. Save the project ZIP and keep the original unchanged.
6. Import it with `python3 scripts/import_airo_export.py /path/to/zip` and inspect the review report.

Source: https://www.godaddy.com/help/download-my-airo-ai-builder-files-and-code-42993

This only applies to GoDaddy **Airo AI Builder**. The distinct GoDaddy **Websites + Marketing** product may not expose the same complete-code export. Check the product label in your GoDaddy account.

Do not add exported secrets, patient data, or confidential business files to a public GitHub repository.
