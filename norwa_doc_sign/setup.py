from setuptools import setup, find_packages

with open("requirements.txt") as f:
	install_requires = f.read().strip().split("\n")

# get version from __version__ variable in norwa_doc_sign/__init__.py
from norwa_doc_sign import __version__ as version

setup(
	name="norwa_doc_sign",
	version=version,
	description="Frappe app for document signing and stamping with auto-fill and draggable placement.",
	author="Ronald (IT-Department Norwa Africa)",
	author_email="it-department@norwaafrica.com",
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires
)
