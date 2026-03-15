import inspect
from typing import List, Type
from instacrud.model.system_model import RootModel
import instacrud.model.system_model as system_model
import instacrud.model.organization_model as organization_model

def _get_rootmodel_subclasses_from_module(module) -> List[Type[RootModel]]:
    classes = []
    for name, obj in inspect.getmembers(module, inspect.isclass):
        if issubclass(obj, RootModel) and obj is not RootModel and obj.__module__ == module.__name__:
            if getattr(obj, "__abstract__", False):
                print(f"Skipping abstract: {module.__name__}.{name}")
                continue
            print(f"Discovered: {module.__name__}.{name}")
            classes.append(obj)
    print(f"Loaded {len(classes)} classes from {module.__name__}")
    return classes

def get_system_models() -> List[Type[RootModel]]:
    return _get_rootmodel_subclasses_from_module(system_model)


def get_organization_models() -> List[Type[RootModel]]:
    return _get_rootmodel_subclasses_from_module(organization_model)
