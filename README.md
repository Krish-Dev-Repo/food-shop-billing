# Countertop — food shop billing

A small browser-based billing app for a food shop. It includes email-and-password sign-in, an item menu, printable bills, saved order details, and a daily sales/profit summary.

## What it uses

- **Vanilla HTML, CSS, and JavaScript:** no build step or package install.
- **Supabase:** hosted password authentication and PostgreSQL storage. Row-level security keeps each shop owner's products and orders private.
- **Netlify or GitHub Pages:** free static hosting. Supabase remains the hosted backend.

The sign-in **username is the owner's email address**. Supabase handles password storage and authentication; this app does not store passwords itself.

## 1. Create the Supabase backend

1. Create a free project at [supabase.com](https://supabase.com/).
2. In the Supabase dashboard, open **SQL Editor → New query**.
3. Open `supabase/schema.sql` in this folder, copy all of it into the editor, and run it. It creates the menu, orders, item snapshots, access policies, and the database functions used to create orders.
4. In **Authentication → Providers**, ensure **Email** is enabled. Email confirmation can remain enabled; new owners will need to confirm the email before signing in.
5. In **Project Settings → API**, copy the **Project URL** and the **anon/public key**. The anon key is designed for browser use; never use the `service_role` key here.

## 2. Configure and run locally

1. Open `config.js` and replace the example values:

   ```js
   window.SHOP_CONFIG = {
     supabaseUrl: "https://your-project.supabase.co",
     supabaseAnonKey: "your-anon-public-key",
     currency: "USD"
   };
   ```

   Change `currency` to your shop's three-letter currency code (for example `INR`, `GBP`, or `EUR`). Menu prices/costs are sample values in that currency.

2. Open this folder in Visual Studio Code and install the **Live Server** extension.
3. Right-click `index.html` and choose **Open with Live Server**. Use the local web address that opens; do not open the HTML as a `file://` URL.
4. Choose **Create an account**, register with the shop owner's email and password, confirm the email if prompted, then sign in.
5. The sample menu is created automatically on first sign-in. Use **Manage menu items** in the app to add items, edit their names/prices/costs, or hide them from future bills. Hidden items and existing bills are preserved.
6. Select quantities and choose **Create bill**. Bills can be printed; orders and their price/cost snapshots are saved in Supabase. Today's orders appear in a compact scrollable list; select **View bill** to open a receipt. **Shop settings** stays collapsed until opened. Use **Download Excel CSV** in Today's orders to download today's bill line items and totals to a file that opens in Excel.

## 3. Deploy free online

### Netlify (quickest)

1. Push this folder to a GitHub repository. `config.js` contains only the public anon key, but do not put any service-role key or password in the repository.
2. Sign in to [Netlify](https://www.netlify.com/) and choose **Add new site → Import an existing project**.
3. Select the repository. Use the app folder as the **base directory** if it is inside a larger repository. Leave build command and publish directory blank/default when deploying this folder as the site root. If Netlify asks for a publish directory, use `.`.
4. After the site is published, in Supabase open **Authentication → URL Configuration** and add the deployed site URL to **Site URL** and **Redirect URLs**.
5. Open the deployed URL and register/sign in.

### GitHub Pages

1. Push these files to a GitHub repository (or put the app files at the root of an existing repository).
2. In the repository, open **Settings → Pages**, choose **Deploy from a branch**, and select the branch and folder containing `index.html`.
3. Add the published site URL to Supabase **Authentication → URL Configuration** as the Site URL and an allowed Redirect URL.

## What gets calculated

- **Revenue:** sum of today's order totals.
- **Profit:** order total minus the saved ingredient/item costs.
- **Profit margin:** profit divided by revenue, shown as a percentage (0% when there are no sales).

Daily totals follow the local browser's calendar day. Each order saves the item name, quantity, sale price, and cost as a snapshot, so later menu price changes do not rewrite old bills.
Daily bill downloads are CSV files that can be opened in Excel or most spreadsheet apps. The app does not email exports; automatic email delivery would require a trusted server-side email service rather than exposing email credentials in the browser.

## Notes

- Keep `config.js` configured for your project before deploying. The anon key is public by design; the database relies on Supabase Auth, row-level security, and the supplied order-creation function for access control.
- Do not disable row-level security or expose a service-role key.
- The starter menu costs and prices are examples; update them in the Supabase Table Editor before using this for real sales.
- This is a lightweight point-of-sale starter, not accounting or tax software. Confirm local tax, receipt, backup, and privacy requirements before relying on it for a business.
