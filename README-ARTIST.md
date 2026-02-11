# ArtSiteMaker - For Artists

**Your beautiful online portfolio, made simple.**

ArtSiteMaker is a powerful site builder designed specifically for artists. Your content (artworks, pages, settings) lives in your own project folder, separate from the application itself. This gives you full control and portability while providing professional tools for managing your portfolio.

---

## 🏗️ How It Works

**Two-Part System:**
1. **ArtSiteMaker** - The site builder application (installed by your developer)
2. **Your Art Project** - Your content folder with artworks, settings, and customizations

Your developer sets up ArtSiteMaker and creates your art project. You manage your content through the admin panel, and your beautiful website is automatically generated.

---

## 🎨 Your Admin Panel

Your admin panel is where you manage everything about your portfolio. The URL will be provided by your developer (usually something like `admin.yoursite.com` or `localhost:4322` for local development).

### The Dashboard

When you log in, you'll see the **Dashboard** with:

- **Quick Stats**: Overview of your gallery items and storage
- **Storage Info**: Current image storage configuration (local or cloud)
- **Quick Actions**: Publishing button to update your live website
- **Recent Activity**: Recent artworks you've added or edited

### Storage Types

Your images can be stored in two ways:

- **Local Storage**: Images stored on your web server (traditional approach)
- **Cloud Storage (R2)**: Images stored on Cloudflare's global network for faster loading worldwide

Your developer will configure this based on your needs and budget.

---

## 🖼️ Managing Your Gallery

### Adding New Artwork

1. Click **"Gallery"** in the sidebar
2. Click **"+ Add New Piece"**
3. Fill in the details:
   - **Title** - Name of your artwork
   - **Year** - When you created it
   - **Medium** - e.g., "Oil on canvas", "Digital", "Watercolor"
   - **Dimensions** - e.g., "24 x 36 inches", "30 x 40 cm"
   - **Description** - Tell the story behind the piece (optional)
   - **Tags** - Keywords to help categorize (e.g., "landscape", "abstract", "portrait")
   - **Price** - If you're selling the piece
   - **Collection** - Group related works together
4. **Upload your image** (drag & drop or click to browse)
   - Supports JPEG, PNG, WebP, TIFF, HEIC formats
   - Maximum 50MB file size
   - Higher resolution is better (minimum 2000px wide recommended)
5. Click **"Create Piece"**

The system automatically creates multiple sizes of your image for different uses (thumbnails, gallery view, full-size viewing) and stores them according to your storage configuration.

### Editing Artwork

1. Click **"Gallery"** in the sidebar
2. Click on the artwork you want to edit
3. Make your changes
4. Click **"Save Changes"**

### Organizing with Collections

Collections help group related artworks:

1. In the Gallery tab, look for **"Collections"** section
2. Click **"+ Add Collection"** to create a new one
3. Give it a name and description
4. Assign artworks to collections when editing them

### Additional Images & Titles

Show "work in progress" shots, detail views, or alternate angles:

1. In the artwork editor, find **"Additional Images"** section
2. Click **"+ Add Images"** to upload extra images
3. Each image gets a title input below it (starts as "Detail 1", "Detail 2", etc.)
4. Edit the titles to describe each image (e.g., "Work in Progress", "Close-up Detail")
5. These titles appear on your public artwork page

---

## 📄 Editing Pages

### About Page

1. Click **"Content"** in the sidebar
2. Click on **"About"**
3. Edit your bio, story, or artist statement
4. Click **"Save"**

### Footer

The footer appears on every page. Edit it in the **Content** tab:
- Your story/description
- Links to other websites
- Contact email
- Copyright information

---

## 🎭 Changing Your Site's Look

### Themes and Style

1. Click **"Settings"** in the sidebar
2. Navigate to the **"Theme & Style"** section
3. Use the **"Customize Theme"** button for deep editing (layout, navigation, etc.)
4. Click **"Browse Themes"** to switch to a completely different theme

### Customizing Colors & Fonts (Identity Kit)

1. Click **"Settings"** in the sidebar
2. Look for the **"Identity Kit"** section
3. Adjust your brand colors, fonts, and textures
4. Click **"Save Settings"** in the top header

Changes appear on your live site after publishing from the Dashboard.

---

## 🖼️ Image Tips & Storage

### For Best Results

- **Resolution**: Upload the highest resolution you have (minimum 2000px wide recommended)
- **Format**: JPEG, PNG, WebP, TIFF, or HEIC files supported
- **File Size**: Maximum 50MB per image
- **Quality**: The system automatically creates optimized versions for web viewing

### How Image Processing Works

When you upload an image, the system automatically:

1. **Processes** your image into multiple sizes:
   - **Large** (2400px) - For full-screen viewing
   - **Medium** (1200px) - For gallery grids
   - **Small** (600px) - For thumbnails
   - **Thumb** (150px) - For admin interface

2. **Optimizes** for web performance:
   - Converts to WebP format for smaller file sizes
   - Maintains quality while reducing bandwidth
   - Creates responsive images for different devices

3. **Stores** according to your configuration:
   - **Local**: On your web server
   - **Cloud (R2)**: On Cloudflare's global network for faster worldwide access

### Storage Benefits

**Local Storage:**
- No additional costs
- Full control over your files
- Good for single-location audiences

**Cloud Storage (R2):**
- Faster loading worldwide
- Automatic backups
- Custom domain support (e.g., images.yourname.com)
- Scales automatically as your portfolio grows

### New Artwork Order

Control where newly uploaded artworks appear in your gallery:

1. Go to **Settings** → **Image Processing** section
2. Find **"New Artwork Position"** at the bottom
3. Choose:
   - **Add to end** - New work appears last (traditional order)
   - **Add to beginning** - New work appears first (great for "latest work" galleries)

---

## 📦 Backups & Data Ownership

Your content is safe and portable!

### Automatic Backups
- **Weekly**: The system automatically creates backups of all your content
- **Retention**: Keeps the last 52 backups (1 year of history)
- **Content**: Includes artwork data, pages, settings, and collections

### Manual Backups
- Go to **Settings** → **Content Backups**
- Click **"Create Backup"** anytime
- Download backups to your computer for safekeeping

### Data Portability
Your content is stored in simple, readable formats:
- **YAML files** for artwork data and settings
- **Standard image formats** for your artwork
- **No proprietary database** - you can always access your data
- **Git versioning** (optional) - track every change

### What's Backed Up
- ✅ Artwork metadata (titles, descriptions, prices, etc.)
- ✅ Collections and organization
- ✅ Site settings and customizations
- ✅ Page content (About page, etc.)
- ✅ Theme customizations
- ⚠️ Original images (stored separately in your chosen storage)

---

## 🚀 Publishing Your Changes

After making any changes:

1. Go to the **Dashboard**
2. Click **"🚀 Update Website"**
3. Wait for confirmation

Your changes are now live!

---

## ⚙️ Settings & Customization

### Site Settings
- **Site Title** - Your portfolio name
- **Tagline** - A short description of your work
- **About Information** - Your artist bio and story

### Identity Kit (Your Brand)
Your Identity Kit contains your persistent branding that stays consistent across different themes:

- **Colors**: Your signature colors for text, links, accents, and backgrounds
- **Fonts**: Your preferred heading and body fonts
- **Logo**: Your artist logo and its dimensions
- **Background**: Custom textures or patterns

### Theme Selection
- **Browse Themes**: Choose from available layout styles
- **Customize**: Modify colors, fonts, and layouts within themes
- **Preview**: See changes before publishing

### Storage Configuration
Your developer manages storage settings, but you can see:
- **Current storage type** (Local or Cloud)
- **Storage usage** and limits
- **Image processing status**

### Authentication Options

Your admin panel can be secured in different ways:

- **GitHub OAuth**: Log in with your GitHub account (most secure)
- **Basic Auth**: Traditional username and password
- **No Auth**: Open access (development/local only)

Your developer will set this up based on your security needs.

---

## 📱 Mobile Access

Good news! Both your public portfolio and admin panel work great on phones and tablets. Manage your gallery from anywhere!

---

## 🆘 Need Help?

### Common Questions

**Q: Why don't I see my changes on the live site?**
A: Make sure you clicked "🚀 Update Website" on the Dashboard after making changes.

**Q: My image looks stretched or cropped strangely.**
A: Try uploading a higher resolution version. The system works best with images at least 2000px wide.

**Q: I can't delete an artwork.**
A: Look for the delete button (🗑️) in the artwork editor. You'll need to confirm before it's permanently deleted.

**Q: How do I mark something as sold?**
A: Edit the artwork and toggle the "Sold" option in the details section.

**Q: Can I change where new artworks appear in my gallery?**
A: Yes! Go to **Settings** → find "New Artwork Position" and choose "Add to beginning" or "Add to end".

**Q: What happens to my data if I want to switch to a different system?**
A: Your data is completely portable! All content is stored in standard formats (YAML + images) that you can download and use elsewhere.

**Q: How do I get my own custom domain for images?**
A: If using cloud storage, your developer can set up a custom domain like `images.yourname.com` for professional branding.

### Getting Technical Help

**For technical issues** (site down, errors, hosting questions):
- Contact your developer or hosting provider
- Check the admin panel's storage info for configuration details
- Download a backup before making major changes

**For content questions** (how to organize, best practices):
- Experiment in the admin panel - changes aren't live until you publish
- Use the preview features to see how changes will look
- Create backups before major reorganization

---

**Happy creating! 🎨**

*Your art deserves a beautiful home on the web.*
