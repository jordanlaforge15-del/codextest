(function () {
  const form = document.querySelector('[data-profile-image-form]');
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const status = form.querySelector('[data-profile-image-status]');
  const fileInput = form.querySelector('input[name="profileImage"]');
  const preview = document.querySelector('.profile-image-preview');
  const placeholder = document.querySelector('.profile-image-placeholder');

  function setStatus(message, isError) {
    if (!(status instanceof HTMLElement)) {
      return;
    }

    status.textContent = message;
    status.dataset.state = isError ? 'error' : 'success';
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.readAsDataURL(file);
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!(fileInput instanceof HTMLInputElement) || !fileInput.files || fileInput.files.length === 0) {
      setStatus('Choose an image to upload.', true);
      return;
    }

    const [file] = fileInput.files;
    if (!file.type.startsWith('image/')) {
      setStatus('The selected file must be an image.', true);
      return;
    }

    setStatus('Uploading profile image…', false);

    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      const response = await fetch('/account/profile-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageDataUrl })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Profile image upload failed');
      }

      const profileImageUrl = payload?.data?.profileImageUrl;
      if (typeof profileImageUrl === 'string' && profileImageUrl.length > 0) {
        if (preview instanceof HTMLImageElement) {
          preview.src = profileImageUrl;
        } else {
          const image = document.createElement('img');
          image.className = 'profile-image-preview';
          image.alt = 'Profile reference';
          image.src = profileImageUrl;
          const block = document.querySelector('.profile-image-block');
          if (block instanceof HTMLElement) {
            block.innerHTML = '';
            block.append(image);
          }
        }

        if (placeholder instanceof HTMLElement) {
          placeholder.remove();
        }
      }

      form.reset();
      setStatus('Profile image uploaded.', false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Profile image upload failed', true);
    }
  });
})();
