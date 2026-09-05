"""Setuptools configuration for the Antardhi prototype."""

from setuptools import find_packages, setup

setup(name="antardhi", version="0.1.0", description="Consent-led alternative-data credit scoring prototype",
      packages=find_packages(), python_requires=">=3.10",
      install_requires=["streamlit>=1.38,<2.0", "pandas>=2.1,<3.0", "plotly>=5.20,<7.0",
                        "numpy>=1.26,<3.0", "scipy>=1.11,<2.0", "scikit-learn>=1.4,<2.0",
                        "lightgbm>=4.0,<5.0", "shap>=0.45,<1.0"])
