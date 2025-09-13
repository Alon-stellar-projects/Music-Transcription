"""
Author: Alon Haviv, Stellar Intelligence.

A module for error handler classes.
"""

class BaseException(Exception):
    """This base class represents a general error. Other error-classes will extend it."""

    def __init__(self, code: int, message: str=''):
        """
        Creates a new error object.
        code - A code from Consts.json.
        message - An optional message. Default value is: ''.
        """
        self.code = code
        self.message = message

    def __str__(self) -> str:
        return f'{self.__class__.__name__} Error code: {self.code}: {self.message}'

    def __repr__(self) -> str:
        return f'{self.__class__.__name__} Error code: {self.code}: {self.message}'

# Expose
__all__ = ['BaseException']
