# Publishing runpack to PyPI

This document provides instructions for publishing the runpack Python package to PyPI.

## Prerequisites

1. **PyPI Account**: You need an account on [PyPI](https://pypi.org/)
2. **API Token**: Generate an API token from your PyPI account settings
   - Go to Account Settings → API tokens → Add API token
   - Set the scope to "Entire account" or limit to "runpack" project
   - Save the token securely (you'll only see it once)

3. **Build Tools**: Install required tools:
   ```bash
   pip install build twine
   ```

## Publishing Process

### 1. Update Version Number

Edit `pyproject.toml` and update the version number:

```toml
[project]
name = "runpack"
version = "0.1.1"  # Increment this
```

Follow [semantic versioning](https://semver.org/):
- **Major** (X.0.0): Breaking changes
- **Minor** (0.X.0): New features, backward compatible
- **Patch** (0.0.X): Bug fixes

### 2. Clean Previous Builds

```bash
cd python
rm -rf dist/ build/ *.egg-info/
```

### 3. Build Distribution Packages

```bash
python -m build
```

This creates:
- `dist/runpack-X.Y.Z-py3-none-any.whl` (wheel distribution)
- `dist/runpack-X.Y.Z.tar.gz` (source distribution)

### 4. Upload to PyPI

```bash
twine upload dist/*
```

You'll be prompted for:
- **Username**: `__token__`
- **Password**: Your PyPI API token (starts with `pypi-`)

Or configure credentials in `~/.pypirc`:

```ini
[pypi]
username = __token__
password = pypi-your-api-token-here
```

### 5. Verify Upload

Visit https://pypi.org/project/runpack/ to verify the package was uploaded successfully.

## Testing Before Publishing (Optional)

You can test the upload process using TestPyPI:

### 1. Upload to TestPyPI

```bash
twine upload --repository testpypi dist/*
```

For TestPyPI credentials, create a separate API token at [test.pypi.org](https://test.pypi.org/).

### 2. Test Installation

```bash
pip install --index-url https://test.pypi.org/simple/ runpack
```

### 3. Upload to Production PyPI

Once verified, upload to the real PyPI as described above.

## Common Issues

### "File already exists"

If you get an error that the file already exists, you need to:
1. Increment the version number in `pyproject.toml`
2. Rebuild the package
3. Upload again

PyPI does not allow re-uploading the same version.

### Authentication Errors

- Ensure you're using `__token__` as the username (literally, not your username)
- Verify your API token is correct and has the right permissions
- Check that the token hasn't expired

### Build Errors

If the build fails:
- Ensure all required files (README.md, LICENSE) are present
- Verify `pyproject.toml` syntax is correct
- Check that all source files are properly included

## Quick Reference

```bash
# Complete publishing workflow
cd python
rm -rf dist/ build/ *.egg-info/
python -m build
twine upload dist/*
```

## Resources

- [PyPI Documentation](https://packaging.python.org/tutorials/packaging-projects/)
- [Twine Documentation](https://twine.readthedocs.io/)
- [Semantic Versioning](https://semver.org/)
