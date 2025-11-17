# 👩‍⚕️ Snaproval

This application allows users to take screenshots of a website and download them as a zip file. It is designed to streamline the process of website exportation for committee approvals.

## Features
- Capture full-page screenshots of websites.
- Download screenshots as a zip file.
- Handle cookie consent banners automatically.
- Highlight and number external links on the page.

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd snaproval
   ```
2. **Create .env file -> example(.env-example)**
   ```bash
   touch .env
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Setup the application**
   ```bash
   npm run setup
   ```

5. **Run the application**
   ```bash
   npm run dev
   ```

## Usage

1. **Input Sitemap URL**
   - Navigate to the application interface.
   - Enter the sitemap URL of the website you wish to export.

2. **Start Crawling**
   - Click the "Start Crawling" button to begin the process.
   - The application will process the URLs from the sitemap and generate screenshots.

3. **Download Screenshots**
   - Once the crawling is complete, download the screenshots as a zip file from the provided link.

## Intended Use Case
This tool is particularly useful for web developers and designers who need to present website designs to committees for approval. By providing a simple way to capture and share website screenshots, it facilitates smoother communication and decision-making processes.